import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { useDataStore } from './data'
import { useResourceStatusStore } from './resourceStatus'
import {
  bulkRecords,
  clearAllStorage,
  compositeSave,
  createRecord,
  deleteDraft,
  executeAction,
  fetchResourceRecords,
  fetchResourceRecordsBatch,
  flushResourceSyncQueue,
  generateReport,
  getDraft,
  getResourceMetaCached,
  getResourceRowsCached,
  initializeDb,
  queueResourceSync,
  registerQueuedSyncHandler,
  runBatchRequests as runBatchRequestsFromService,
  saveDraft,
  setAuthorizedResources,
  setResourceMetaCached,
  syncResourcesBatch,
  updateRecord,
  upsertResourceRowsCached
} from 'src/services/ResourceIoService'
import { standardizeResponse } from 'src/services/_logger'

function normalizeResponse(response, fallbackData = null) {
  if (response && typeof response === 'object' && 'success' in response) {
    const resultPayload = response?.data?.result
    const reportArtifact = response?.data?.artifacts?.report
    let normalizedData = response.success
      ? (resultPayload ?? response.data ?? fallbackData)
      : null

    if (response.success && reportArtifact && typeof reportArtifact === 'object') {
      normalizedData = {
        ...(normalizedData && typeof normalizedData === 'object' ? normalizedData : {}),
        ...reportArtifact
      }
    }

    return {
      success: response.success === true,
      data: normalizedData,
      error: response.success ? null : (response.error || response.message || 'Request failed'),
      message: response.message || ''
    }
  }

  return {
    success: false,
    data: null,
    error: 'Invalid response',
    message: ''
  }
}

function normalizeResourceNames(resourceNames = []) {
  return Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : [resourceNames])
    .map((entry) => (entry || '').toString().trim())
    .filter(Boolean)))
}

export const useResourceIoStore = defineStore('resourceIo', () => {
  function getAuthContext() {
    const auth = useAuthStore()
    return {
      authorizedResources: auth.authorizedResources || [],
      appConfig: auth.appConfigMap || {}
    }
  }

  function hydrateResourcePayload(resourcePayload = {}) {
    const dataStore = useDataStore()
    Object.entries(resourcePayload || {}).forEach(([resourceName, resourceData]) => {
      if (!resourceData || typeof resourceData !== 'object') return

      if (Array.isArray(resourceData.headers) && resourceData.headers.length) {
        dataStore.initResource(resourceName, resourceData.headers)
      }
      if (!Array.isArray(resourceData.rows)) return

      const meta = resourceData.meta || {}
      const isSkipped = meta.skipped === true || meta.source === 'syncing-skip'
      const isTimedOut = meta.timedOut === true || meta.source === 'cache-timeout'
      const isFailed = meta.failed === true || meta.source === 'unavailable' || meta.source === 'cache-error'
      const isFallback = meta.isFallback === true

      if (isSkipped || isTimedOut || isFailed || isFallback) {
        return
      }

      if (meta.hasDeltaFilter || meta.directWrite) {
        dataStore.setRows(resourceName, resourceData.rows)
        return
      }

      const isConfirmedValidEmpty = meta.validEmpty === true
      const isConfirmedFull = meta.confirmedFull === true

      if (isConfirmedFull) {
        if (resourceData.rows.length === 0 && !isConfirmedValidEmpty) {
          return
        }
        dataStore.replaceRows(resourceName, resourceData.rows)
      }
    })
  }

  /**
   * Ensures every synced resource is present in `useDataStore`. Rows the sync
   * just wrote already arrived via `onRowsUpserted`, and `seedResourceFromCache`
   * skips anything already read, so this only covers unseeded resources.
   */
  async function hydrateSyncedResourcesFromCache(resourceNames = [], options = {}) {
    const names = normalizeResourceNames(resourceNames)
    if (!names.length) return

    const dataStore = useDataStore()
    const resourceStatus = useResourceStatusStore()

    for (const resourceName of names) {
      const headers = resourceStatus.byResource[resourceName]?.headers || []
      if (headers.length) {
        dataStore.initResource(resourceName, headers)
      }
      const shouldRecover = typeof options.recoverMissing === 'function'
        ? options.recoverMissing(resourceName)
        : options.recoverMissing !== false
      await dataStore.seedResourceFromCache(resourceName, { force: true, recoverMissing: shouldRecover })
    }
  }

  async function fetchResource(resourceName, options = {}) {
    if (!resourceName) {
      return { success: false, headers: [], rows: [], records: [] }
    }

    const dataStore = useDataStore()
    const resourceStatus = useResourceStatusStore()
    const { authorizedResources, appConfig } = getAuthContext()
    dataStore.ensureResourceState(resourceName)
    dataStore.loadingByResource[resourceName] = true

    try {
      const response = await fetchResourceRecords(resourceName, authorizedResources, appConfig, {
        ...options,
        resourceStatus
      })
      const payload = response?.data || {}
      const meta = payload.meta || response?.meta || {}
      const responseHeaders = Array.isArray(payload.headers) ? payload.headers : []
      const responseRows = Array.isArray(payload.rows) ? payload.rows : []

      if (responseHeaders.length) {
        dataStore.initResource(resourceName, responseHeaders)
      }

      const isSkipped = meta.skipped === true || meta.source === 'syncing-skip' || response?.message === 'Resource already syncing'
      const isTimedOut = meta.timedOut === true || meta.source === 'cache-timeout' || response?.error === 'Cache read timed out' || (typeof response?.error === 'string' && response.error.includes('timed out'))
      const isFailed = !response.success || meta.failed === true || meta.source === 'unavailable' || meta.source === 'cache-error'
      const isFallback = meta.isFallback === true
      const isConfirmedValidEmpty = meta.validEmpty === true && !isFailed && !isTimedOut && !isSkipped

      const isConfirmedFull = meta.confirmedFull === true && !isFailed && !isTimedOut && !isSkipped && !isFallback
      const shouldKeepExistingRows = isSkipped || isTimedOut || isFailed || isFallback || (!isConfirmedFull && !meta.hasDeltaFilter && !meta.directWrite)

      if (!shouldKeepExistingRows && Array.isArray(payload.rows)) {
        if (meta.hasDeltaFilter || meta.directWrite) {
          dataStore.setRows(resourceName, responseRows)
        } else if (isConfirmedFull) {
          if (responseRows.length > 0 || isConfirmedValidEmpty) {
            dataStore.replaceRows(resourceName, responseRows)
          }
        }
      }

      let currentScreenRows = dataStore.getRows(resourceName)
      if (!isConfirmedValidEmpty) {
        await dataStore.seedResourceFromCache(resourceName, { force: true, recoverMissing: true }).catch(() => {})
        currentScreenRows = dataStore.getRows(resourceName)
      }

      return {
        ...response,
        headers: responseHeaders.length ? responseHeaders : (dataStore.headers[resourceName] || []),
        rows: currentScreenRows,
        records: dataStore.getRecords(resourceName),
        meta: {
          ...meta,
          skipped: isSkipped,
          timedOut: isTimedOut,
          failed: isFailed,
          validEmpty: isConfirmedValidEmpty
        }
      }
    } finally {
      dataStore.loadingByResource[resourceName] = false
    }
  }

  async function syncResource(resourceName, options = {}) {
    if (!resourceName) {
      return { success: false, headers: [], rows: [], records: [] }
    }

    const dataStore = useDataStore()
    dataStore.backgroundSyncingByResource[resourceName] = true
    try {
      return await fetchResource(resourceName, options)
    } finally {
      dataStore.backgroundSyncingByResource[resourceName] = false
    }
  }

  async function fetchResources(resourceNames = [], payload = {}) {
    const resources = normalizeResourceNames(resourceNames)
    if (!resources.length) {
      return normalizeResponse({ success: true, data: { result: { resources: [] } } })
    }

    const { authorizedResources, appConfig } = getAuthContext()
    const resourceStatus = useResourceStatusStore()
    const recoveryResources = Array.isArray(payload.recoveryResources)
      ? payload.recoveryResources
      : []
    const recoverMissing = payload.recoverMissing === true || recoveryResources.length > 0

    const response = await fetchResourceRecordsBatch(resources, authorizedResources, appConfig, {
      showLoading: payload.showLoading === true,
      showError: payload.showError === true,
      forceSync: payload.forceSync === true,
      recoverMissing,
      recoveryResources,
      resourceStatus
    })

    const resourcePayload = response.data?.resources || {}
    hydrateResourcePayload(resourcePayload)

    const synced = Array.isArray(response.data?.synced) ? response.data.synced : []
    const failed = Array.isArray(response.data?.failed) ? response.data.failed : []
    const skipped = Array.isArray(response.data?.skipped) ? response.data.skipped : []

    return {
      success: response.success === true,
      partial: response.partial === true || (failed.length > 0 && synced.length > 0),
      data: {
        resources: resourcePayload,
        synced,
        failed,
        skipped,
        result: {
          resources: resourcePayload,
          synced,
          failed,
          skipped
        }
      },
      error: response.success ? null : (response.error || response.message || 'Failed to fetch resources'),
      message: response.message || ''
    }
  }

  async function syncResources(resourceNames = [], options = {}) {
    const resources = normalizeResourceNames(resourceNames)
    if (!resources.length) {
      return normalizeResponse(standardizeResponse(true, {
        resources: [],
        recordsByResource: {},
        lastSyncAt: Date.now()
      }), {})
    }

    const { authorizedResources, appConfig } = getAuthContext()
    const resourceStatus = useResourceStatusStore()
    const recoveryResources = Array.isArray(options.recoveryResources)
      ? options.recoveryResources
      : []
    const recoverMissing = options.recoverMissing === true || recoveryResources.length > 0

    const response = await syncResourcesBatch(resources, authorizedResources, appConfig, {
      showLoading: options.showLoading === true,
      showError: options.showError === true,
      forceSync: options.forceSync === true,
      background: options.background === true,
      recoverMissing,
      recoveryResources,
      resourceStatus
    })

    const syncedResources = Array.isArray(response.data?.synced) ? response.data.synced : []
    const failedResources = Array.isArray(response.data?.failed) ? response.data.failed : []
    const skippedResources = Array.isArray(response.data?.skipped) ? response.data.skipped : []

    if (syncedResources.length) {
      await hydrateSyncedResourcesFromCache(syncedResources, {
        recoverMissing: (res) => recoverMissing && (!recoveryResources.length || recoveryResources.includes(res))
      })
    }

    if (!response.success && !syncedResources.length) {
      return {
        success: false,
        data: {
          resources,
          synced: [],
          failed: failedResources.length ? failedResources : resources,
          skipped: skippedResources
        },
        error: response.error || response.message || 'Resource sync failed',
        message: response.message || ''
      }
    }

    return {
      success: response.success === true,
      partial: failedResources.length > 0 && syncedResources.length > 0,
      data: {
        resources,
        recordsByResource: {},
        summary: response.data || {},
        synced: syncedResources,
        failed: failedResources,
        skipped: skippedResources,
        lastSyncAt: Date.now()
      },
      error: response.success ? null : (response.error || 'Partial sync completed'),
      message: response.message || (response.success ? 'Sync completed' : 'Partial sync completed')
    }
  }

  function queueResource(resourceName, dueAt, reason = '') {
    queueResourceSync(resourceName, dueAt, reason)
    return { success: true, data: { resourceName, dueAt, reason }, error: null }
  }

  async function flushQueue(options = {}) {
    const response = await flushResourceSyncQueue(options)
    return normalizeResponse(response, {})
  }

  async function executeResourceAction(resourceName, code, actionConfig, fields = {}) {
    const response = await executeAction(resourceName, code, actionConfig, fields)
    return normalizeResponse(response)
  }

  async function createResourceRecord(resourceName, record) {
    const response = await createRecord(resourceName, record)
    return normalizeResponse(response)
  }

  async function updateResourceRecord(resourceName, code, record) {
    const response = await updateRecord(resourceName, code, record)
    return normalizeResponse(response)
  }

  async function saveComposite(payload) {
    const response = await compositeSave(payload)
    return normalizeResponse(response)
  }

  async function uploadBulkRecords(resourceName, records = []) {
    const response = await bulkRecords(resourceName, records)
    return normalizeResponse(response)
  }

  async function generateReportFile(payload = {}) {
    const response = await generateReport(payload)
    return normalizeResponse(response)
  }

  async function runBatchRequests(requests = []) {
    const response = await runBatchRequestsFromService(requests)
    hydrateResourcePayload(response.resources || {})
    return response
  }

  async function initializeClientCache(resources = [], resetCursors = false) {
    await initializeDb()
    return setAuthorizedResources(resources, resetCursors)
  }

  async function clearClientCache() {
    return clearAllStorage()
  }

  registerQueuedSyncHandler((resourceNames, options = {}) => syncResources(resourceNames, options))

  return {
    fetchResource,
    syncResource,
    fetchResources,
    syncResources,
    queueResource,
    flushQueue,
    executeResourceAction,
    createResourceRecord,
    updateResourceRecord,
    saveComposite,
    uploadBulkRecords,
    generateReportFile,
    runBatchRequests,
    initializeClientCache,
    clearClientCache,
    getResourceMeta: getResourceMetaCached,
    setResourceMeta: setResourceMetaCached,
    getResourceRows: getResourceRowsCached,
    upsertResourceRows: upsertResourceRowsCached,
    getDraft,
    saveDraft,
    deleteDraft
  }
})
