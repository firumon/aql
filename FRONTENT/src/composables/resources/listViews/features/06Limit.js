import { unref } from 'vue'

const KIND = 'Limit'

export default function limitFeature (records, config) {
  if (!Array.isArray(records)) {
    throw new TypeError(`[feature/${KIND}] records must be an array, got ${typeof records}`)
  }
  const view = config?.view || null
  const listName = String(config?.listName || '')
  const overrideState = config?.overrideFor?.(listName, KIND)
  const limit = view?.limit
  if (limit != null && (!Number.isInteger(limit) || limit < 0)) {
    throw new TypeError(`[feature/${KIND}] List "${listName}": limit must be a whole number of rows, got ${JSON.stringify(limit)}`)
  }
  const coreRows = limit == null ? records : records.slice(0, limit)

  if (!overrideState || overrideState.status === 'none') return coreRows
  if (overrideState.status === 'error') {
    throw overrideState.error || new Error(`[feature/${KIND}] list${listName}${KIND}.js failed to load.`)
  }
  if (overrideState.status !== 'ready') return coreRows
  if (typeof overrideState.module !== 'function') {
    throw new TypeError(`[feature/${KIND}] list${listName}${KIND}.js must export a function, got ${typeof overrideState.module}`)
  }
  const out = unref(overrideState.module(coreRows, records, view))
  if (!Array.isArray(out)) {
    throw new TypeError(`[feature/${KIND}] list${listName}${KIND}.js must return an array, got ${typeof out}`)
  }
  return out
}
