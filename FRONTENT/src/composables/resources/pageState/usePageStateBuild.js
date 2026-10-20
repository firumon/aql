import {
  compositeSaveRequest,
  executeActionRequest,
  resourceBulkRequest,
  resourceCreateRequest,
  resourceGetRequest,
  resourceUpdateRequest
} from '../resourceRequests'
import { computeRegion } from '../useRegionCompute'
import { findResourceConfig } from '../useResourceConfig'

// Turns node state into GAS request envelopes. A `strategy.build` override
// replaces `defaultBuild` and must append `additionalActionRequests()` itself.
export function usePageStateBuild ({ state, registry }) {
  // Queued actions are pure domain models in state; the executeAction wire format
  // is put on here, deduped by key so a re-queued action runs once.
  function additionalActionRequests () {
    const seen = new Set()
    const requests = []
    for (const entry of state.actions) {
      if (!entry?.resource || seen.has(entry.key)) continue
      seen.add(entry.key)
      requests.push(executeActionRequest(entry.resource, entry.code, entry.actionConfig, entry.data))
    }
    return requests
  }

  // Every resource a queued action asks to be re-read.
  function actionReloadNames () {
    return state.actions.flatMap((entry) => (Array.isArray(entry?.reload) ? entry.reload : []))
  }

  function defaultHydrate (node, raw) {
    Object.assign(node.record, raw || {})
    if (raw && raw.Code) node.code = raw.Code
  }

  function withPayload (request, node) {
    if (!request || !node.payload || !Object.keys(node.payload).length) return request
    return { ...request, payload: { ...request.payload, ...node.payload } }
  }

  const wireData = (row, headers) => {
    const data = {}
    for (const key of Object.keys(row)) {
      if (headers.has(key) && key.charAt(0) !== '_') data[key] = row[key]
    }
    return data
  }

  function stampRegion (res, data, headers) {
    if (!headers.has('AccessRegion')) return data
    const regionCode = computeRegion(res, data)
    if (regionCode && !data.AccessRegion) data.AccessRegion = regionCode
    return data
  }

  function requestForNode (node) {
    const resource = node.resource
    const headers = new Set(findResourceConfig(resource)?.headers || [])
    if (node.many) {
      const records = node.records.map((r) => stampRegion(resource, wireData(r, headers), headers))
      return records.length ? resourceBulkRequest(resource, records) : null
    }
    if (node.children.length) {
      const children = node.children.map(c => {
        const childHeaders = new Set(findResourceConfig(c.resource)?.headers || [])
        return {
          resource: c.resource,
          records: c.records.map((row) => ({
            _action: row._action || 'create',
            data: stampRegion(c.resource, wireData(row, childHeaders), childHeaders)
          }))
        }
      })
      const data = wireData(node.record, headers)
      stampRegion(resource, data, headers)
      return node.code
        ? compositeSaveRequest({ resource, code: node.code, data, children })
        : compositeSaveRequest({ resource, data, children })
    }
    const data = wireData(node.record, headers)
    if (!Object.keys(data).length) return null
    stampRegion(resource, data, headers)
    return node.code
      ? resourceUpdateRequest(resource, node.code, data)
      : resourceCreateRequest(resource, data)
  }

  function writtenResources () {
    const names = new Set()
    registry.eachNode((node) => {
      if (!requestForNode(node)) return
      names.add(node.resource)
      for (const bucket of node.children || []) {
        if (bucket.resource && bucket.records?.length) names.add(bucket.resource)
      }
    })
    for (const entry of state.actions) {
      if (entry?.resource) names.add(entry.resource)
    }
    return names
  }

  function reloadNames (extra = []) {
    const list = [...state.reload, ...actionReloadNames(), ...(Array.isArray(extra) ? extra : [extra])]
    const written = writtenResources()
    return [...new Set(list.filter(Boolean))].filter((name) => !written.has(name))
  }

  function defaultBuild ({ reload } = {}) {
    const requests = []
    let headersReady = true
    registry.eachNode((node) => {
      const hasRows = node.many ? node.records.length > 0 : node.children.length > 0 || Object.keys(node.record).length > 0
      if (hasRows && !findResourceConfig(node.resource)?.headers?.length) headersReady = false
      for (const child of node.children) {
        if (child.records.length && !findResourceConfig(child.resource)?.headers?.length) headersReady = false
      }
      const request = withPayload(requestForNode(node), node)
      if (request) requests.push(request)
    })
    if (!headersReady) return []
    // Queued actions go after every node, so a `$ref` naming a record this batch
    // creates resolves against a row that already exists.
    requests.push(...additionalActionRequests())
    // The re-read goes last of all, so it sees the finished batch.
    const names = reloadNames(reload)
    if (names.length) requests.push(resourceGetRequest(names, {}))
    return requests
  }

  return { defaultHydrate, defaultBuild, reloadNames, additionalActionRequests }
}
