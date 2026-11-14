import { executeGasApi } from 'src/services/GasApiService'
import {
  getResourceMeta,
  getResourceRows,
  setResourceMeta,
  upsertResourceRows
} from 'src/services/IndexedDbService'
import {
  authorizedResourcesSet,
  dbInitialize,
  draftDelete,
  draftGet,
  draftSave,
  metaGet,
  metaGetAll,
  metaSet,
  rowsGet,
  rowsUpsert,
  storagesClear
} from 'src/services/IndexedDbCacheService'
import {
  mapRowsToObjects,
  normalizeCursorValue,
  resolveSyncRows
} from 'src/utils/appHelpers'
import { createLogger, standardizeResponse } from './_logger'

const DB_TIMEOUT_MS = 1200
const DEFAULT_RESOURCE_SYNC_TTL_SEC = 300
const MIN_QUEUE_WAIT_MS = 250

const logger = createLogger('ResourceIoService')
const resourceSyncQueue = new Map()
const inFlightResourceNames = new Set()
const skippedUnauthorizedHeaders = new Set()
let queueTimerId = null
let queueFlushPromise = null
let queuedSyncHandler = null

const TIMEOUT_TOKEN = Symbol('timeout')

export async function withTimeoutDetailed(promise, fallbackValue, label = '', timeoutMs = DB_TIMEOUT_MS) {
  let timerId = null
  try {
    const result = await Promise.race([
      promise,
      new Promise((resolve) => {
        timerId = setTimeout(() => resolve(TIMEOUT_TOKEN), timeoutMs)
      })
    ])
    if (result === TIMEOUT_TOKEN) {
      logger.warn('Deferred operation timed out; using fallback', {
        ...(label ? { operation: label } : {})
      })
      return { status: 'timeout', data: fallbackValue, error: 'Operation timed out' }
    }
    return { status: 'success', data: result, error: null }
  } catch (error) {
    logger.error('Deferred operation failed; using fallback', {
      ...(label ? { operation: label } : {}),
      error: error?.message || String(error)
    })
    return { status: 'error', data: fallbackValue, error: error?.message || String(error) }
  } finally {
    if (timerId) clearTimeout(timerId)
  }
}

export async function withTimeout(promise, fallbackValue, label = '') {
  const result = await withTimeoutDetailed(promise, fallbackValue, label)
  return result.data
}

function normalizeName(value) {
  return (value || '').toString().trim()
}

function getConfigNumber(appConfig = {}, keys = []) {
  for (const key of keys) {
    const parsed = Number(appConfig?.[key])
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed)
    }
  }
  return null
}

export function getResourceSyncTtl(resourceName, authorizedResources = [], appConfig = {}) {
  const resource = authorizedResources.find((entry) => entry?.name === resourceName)
  const scope = normalizeName(resource?.scope).toLowerCase()
  const scopePascal = scope ? `${scope.charAt(0).toUpperCase()}${scope.slice(1)}` : ''

  return getConfigNumber(appConfig, [
    resource?.syncTTL,
    resource?.SyncTTL,
    `${scope}syncttl`,
    `${scope}SyncTTL`,
    `${scopePascal}SyncTTL`
  ]) || DEFAULT_RESOURCE_SYNC_TTL_SEC
}

export function getCacheRefreshedAt(meta = {}) {
  return normalizeCursorValue(meta?.lastFetchAt)
    || normalizeCursorValue(meta?.cacheRefreshedAt)
    || normalizeCursorValue(meta?.syncedAt)
    || null
}

export function isWithinTtl(refreshedAt, ttlMs) {
  return !!refreshedAt && ttlMs > 0 && Date.now() < refreshedAt + ttlMs
}

function resolveHeadersFromContext(resourceName, meta = {}, authorizedResources = []) {
  if (Array.isArray(meta?.headers) && meta.headers.length) {
    return meta.headers
  }

  const storeResource = authorizedResources.find((entry) => entry?.name === resourceName)
  return Array.isArray(storeResource?.headers) ? storeResource.headers : []
}

export async function readCachedResourcePayload(resourceName, authorizedResources = [], source = 'cache') {
  const metaResult = await withTimeoutDetailed(getResourceMeta(resourceName), null, `meta:${resourceName}`)
  const meta = metaResult.data
  const headers = resolveHeadersFromContext(resourceName, meta, authorizedResources)
  const rowsResult = await withTimeoutDetailed(getResourceRows(resourceName), [], `rows:${resourceName}`)
  const rows = rowsResult.data

  const timedOut = metaResult.status === 'timeout' || rowsResult.status === 'timeout'
  const failed = metaResult.status === 'error' || rowsResult.status === 'error'
  const isSkipped = source === 'syncing-skip'
  const validEmpty = !timedOut && !failed && rowsResult.status === 'success' && rows.length === 0

  let effectiveSource = source
  if (timedOut) effectiveSource = 'cache-timeout'
  else if (failed) effectiveSource = 'cache-error'

  return {
    headers,
    rows,
    records: headers.length ? mapRowsToObjects(rows, headers) : [],
    meta: {
      resource: resourceName,
      source: effectiveSource,
      skipped: isSkipped,
      timedOut,
      failed,
      validEmpty,
      lastSyncAt: normalizeCursorValue(meta?.lastSyncAt) || null,
      lastDataUpdatedAt: normalizeCursorValue(meta?.lastDataUpdatedAt) || null,
      lastFetchAt: getCacheRefreshedAt(meta)
    }
  }
}

function isResourceInAuthorizedList(resourceName, authorizedResources = []) {
  if (!Array.isArray(authorizedResources) || !authorizedResources.length) {
    return true
  }
  return authorizedResources.some((entry) => entry?.name === resourceName)
}

export async function ensureHeaders(resourceName, authorizedResources = []) {
  if (!isResourceInAuthorizedList(resourceName, authorizedResources)) {
    if (!skippedUnauthorizedHeaders.has(resourceName)) {
      skippedUnauthorizedHeaders.add(resourceName)
      logger.info('Resource not in this role\'s list, skipping', { resource: resourceName })
    }
    return standardizeResponse(false, [], 'Headers unavailable')
  }

  try {
    const meta = await withTimeout(getResourceMeta(resourceName), null)
    if (Array.isArray(meta?.headers) && meta.headers.length) {
      logger.debug('Headers from cache', { resource: resourceName })
      return standardizeResponse(true, meta.headers)
    }

    const storeResource = authorizedResources.find((entry) => entry?.name === resourceName)
    if (Array.isArray(storeResource?.headers) && storeResource.headers.length) {
      logger.debug('Headers from store', { resource: resourceName })
      withTimeout(setResourceMeta(resourceName, {
        headers: storeResource.headers
      }), null, `setHeaders:${resourceName}`)
      return standardizeResponse(true, storeResource.headers)
    }

    const response = await executeGasApi('getAuthorizedResources', { includeHeaders: true })
    if (response.success && Array.isArray(response.data?.result?.resources)) {
      const found = response.data.result.resources.find((entry) => entry?.name === resourceName)
      if (Array.isArray(found?.headers) && found.headers.length) {
        logger.debug('Headers from API', { resource: resourceName })
        withTimeout(setResourceMeta(resourceName, { headers: found.headers }), null, `setHeaders:${resourceName}`)
        return standardizeResponse(true, found.headers)
      }
    }

    logger.warn('No headers found', { resource: resourceName })
    return standardizeResponse(false, [], 'Headers unavailable')
  } catch (error) {
    logger.error('Headers ensure failed', { resource: resourceName, error: error.message })
    return standardizeResponse(false, [], error.message)
  }
}

async function buildLastUpdatedAtByResource(resourceNames = []) {
  const uniqueNames = Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : [])
    .map(normalizeName)
    .filter(Boolean)))

  const cursorMap = {}
  for (const resourceName of uniqueNames) {
    try {
      const meta = await getResourceMeta(resourceName)
      const cursor = normalizeCursorValue(meta?.lastDataUpdatedAt) || null
      cursorMap[resourceName] = cursor
    } catch {
      cursorMap[resourceName] = null
    }
  }

  return cursorMap
}

function collectBatchCursorResources(requests = []) {
  const names = []
  requests.forEach((request) => {
    const resourceSelector = Array.isArray(request?.resource) ? request.resource : [request?.resource]
    resourceSelector.filter(Boolean).forEach((name) => names.push(name))
    const payloadCursorResources = request?.payload?.lastUpdatedAtResources
    if (Array.isArray(payloadCursorResources)) {
      payloadCursorResources.filter(Boolean).forEach((name) => names.push(name))
    }
  })
  return Array.from(new Set(names))
}

async function persistBatchResourcePayload(resourceName, resourceData = {}) {
  if (!resourceName || !resourceData || typeof resourceData !== 'object') return false
  if (resourceData.error || resourceData.success === false) return false

  if (!Array.isArray(resourceData.rows)) return false

  const responseHeaders = Array.isArray(resourceData.headers) && resourceData.headers.length
    ? resourceData.headers
    : []
  const meta = await getResourceMeta(resourceName)
  const metaHeaders = Array.isArray(meta?.headers) && meta.headers.length ? meta.headers : []
  const headers = responseHeaders.length ? responseHeaders : metaHeaders

  if (!headers.length) return false

  const rows = resourceData.rows
  if (rows.length > 0) {
    const timeoutMs = rows.length > 1000
      ? Math.min(30000, DB_TIMEOUT_MS + Math.ceil((rows.length - 1000) / 1000) * 3000)
      : DB_TIMEOUT_MS
    const writeResult = await withTimeoutDetailed(rowsUpsert(resourceName, headers, rows), 0, `rowsUpsert:${resourceName}`, timeoutMs)
    if (writeResult.status !== 'success' || !writeResult.data || writeResult.data.success !== true || writeResult.data.data?.affected !== rows.length) {
      logger.error('Failed to store batch rows', { resource: resourceName, writeResult })
      return false
    }
  }

  if (resourceData.meta && typeof resourceData.meta === 'object') {
    const serverDataCursor = normalizeCursorValue(resourceData.meta.lastDataUpdatedAt)
    const existingDataCursor = normalizeCursorValue(meta?.lastDataUpdatedAt)
    const effectiveDataCursor = serverDataCursor || existingDataCursor || null

    const metaResult = await withTimeoutDetailed(metaSet(resourceName, {
      ...(headers.length ? { headers } : {}),
      lastSyncAt: Date.now(),
      ...(effectiveDataCursor ? { lastDataUpdatedAt: effectiveDataCursor } : {}),
      lastFetchAt: Date.now(),
      hasHydratedOnce: true
    }), null, `metaSet:${resourceName}`)

    if (metaResult.status !== 'success' || !metaResult.data || metaResult.data.success !== true) {
      return false
    }
    return true
  }
  return true
}

export async function syncResourcesBatch(resourceNames = [], authorizedResources = [], appConfig = {}, options = {}) {
  let syncNames = []
  try {
    const uniqueNames = Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : []).filter(Boolean)))
    if (!uniqueNames.length) {
      return standardizeResponse(true, {}, 'No resources to sync')
    }

    const resourceStatus = options.resourceStatus || null
    syncNames = typeof resourceStatus?.filterAvailableResources === 'function'
      ? resourceStatus.filterAvailableResources(uniqueNames)
      : uniqueNames
    const skipped = uniqueNames.filter((resourceName) => !syncNames.includes(resourceName))

    if (!syncNames.length) {
      logger.info('Batch sync skipped; resources already syncing', { resources: skipped.length })
      return standardizeResponse(true, {
        resourceCount: 0,
        synced: [],
        skipped
      }, 'Resources already syncing')
    }

    resourceStatus?.markSyncStarted?.(syncNames)
    logger.info('Syncing batch', { resources: syncNames.length, skipped: skipped.length })

    const headersByResource = {}
    const cursorByResource = {}
    const unavailableResources = []

    for (const resourceName of syncNames) {
      const headersResp = await ensureHeaders(resourceName, authorizedResources)
      if (headersResp.success && headersResp.data.length) {
        headersByResource[resourceName] = headersResp.data
        resourceStatus?.setHeaders?.(resourceName, headersResp.data)
      } else {
        unavailableResources.push(resourceName)
      }

      const meta = await withTimeout(getResourceMeta(resourceName), null)
      const cachedRowsResult = await withTimeoutDetailed(getResourceRows(resourceName), [], `checkRows:${resourceName}`)
      const rowCount = Array.isArray(cachedRowsResult.data) ? cachedRowsResult.data.length : 0
      const hasHydratedOnce = meta?.hasHydratedOnce === true
      const cacheTimedOut = cachedRowsResult.status === 'timeout' || cachedRowsResult.status === 'error'

      let cursor = normalizeCursorValue(meta?.lastDataUpdatedAt) || null

      const isRecoveringMissing = Array.isArray(options.recoveryResources)
        ? options.recoveryResources.includes(resourceName)
        : (options.recoverMissing === true || options.forceRecovery === true)
      if ((rowCount === 0 && !cacheTimedOut && hasHydratedOnce) || isRecoveringMissing) {
        cursor = null
      }

      if (cursor) {
        cursorByResource[resourceName] = cursor
      }
    }

    const payload = {
      resource: syncNames,
      ...(Object.keys(cursorByResource).length
        ? { lastUpdatedAtByResource: cursorByResource }
        : {})
    }

    logger.debug('Fetching resources', { count: syncNames.length })
    const response = await executeGasApi('get', payload, {
      showLoading: options.showLoading === true,
      showError: options.showError === true,
      background: options.background === true
    })

    if (!response.success) {
      const failMessage = response.message || 'Failed to sync resources'
      logger.error('Sync failed', { error: failMessage })
      resourceStatus?.markSyncFailed?.(syncNames, failMessage)
      return standardizeResponse(false, {}, failMessage)
    }

    const mergedResponseData = (response?.data?.resources && typeof response.data.resources === 'object')
      ? response.data.resources
      : {}
    const metaByResource = {}
    const completedResources = []

    for (const resourceName of syncNames) {
      const resourceResponse = mergedResponseData[resourceName]
      if (!resourceResponse || typeof resourceResponse !== 'object' || !Array.isArray(resourceResponse.rows) || resourceResponse.error || resourceResponse.success === false) {
        logger.warn('Resource response missing or invalid in batch', { resource: resourceName })
        if (!unavailableResources.includes(resourceName)) {
          unavailableResources.push(resourceName)
        }
        continue
      }

      const headers = headersByResource[resourceName] || (await ensureHeaders(resourceName, authorizedResources)).data
      if (!headers.length) {
        if (!unavailableResources.includes(resourceName)) {
          unavailableResources.push(resourceName)
        }
        continue
      }
      const unavailableIndex = unavailableResources.indexOf(resourceName)
      if (unavailableIndex !== -1) {
        unavailableResources.splice(unavailableIndex, 1)
      }

      let deltaRows = []
      try {
        deltaRows = resolveSyncRows(resourceResponse, headers)
      } catch (err) {
        logger.error('Failed to resolve sync rows', { resource: resourceName, error: err?.message })
        if (!unavailableResources.includes(resourceName)) {
          unavailableResources.push(resourceName)
        }
        continue
      }

      let storageOk = true
      if (deltaRows.length > 0) {
        logger.debug('Upserting rows', { resource: resourceName, count: deltaRows.length })
        const writeResult = await withTimeoutDetailed(upsertResourceRows(resourceName, headers, deltaRows), 0, `upsert:${resourceName}`)
        if (writeResult.status !== 'success' || typeof writeResult.data !== 'number' || writeResult.data !== deltaRows.length) {
          logger.error('Failed or timed out row storage', { resource: resourceName, status: writeResult.status })
          storageOk = false
        }
      }

      if (!storageOk) {
        if (!unavailableResources.includes(resourceName)) {
          unavailableResources.push(resourceName)
        }
        continue
      }

      const existingMeta = await withTimeout(getResourceMeta(resourceName), null)
      const serverDataCursor = normalizeCursorValue(resourceResponse?.meta?.lastDataUpdatedAt)
      const existingDataCursor = normalizeCursorValue(existingMeta?.lastDataUpdatedAt)
      const effectiveDataCursor = serverDataCursor || existingDataCursor || null

      const nextMeta = {
        headers,
        lastSyncAt: Date.now(),
        ...(effectiveDataCursor ? { lastDataUpdatedAt: effectiveDataCursor } : {}),
        lastFetchAt: Date.now(),
        hasHydratedOnce: true
      }

      const metaWriteResult = await withTimeoutDetailed(setResourceMeta(resourceName, nextMeta), null, `setResourceMeta:${resourceName}`)
      if (metaWriteResult.status === 'success') {
        metaByResource[resourceName] = nextMeta
        completedResources.push(resourceName)
      } else {
        if (!unavailableResources.includes(resourceName)) {
          unavailableResources.push(resourceName)
        }
      }
    }

    if (completedResources.length) {
      resourceStatus?.markSyncFinished?.(completedResources, metaByResource)
    }
    if (unavailableResources.length) {
      resourceStatus?.markSyncFailed?.(unavailableResources, 'Sync failed or storage incomplete')
    }

    const isFullSuccess = unavailableResources.length === 0 && completedResources.length > 0
    const hasAnySuccess = completedResources.length > 0
    const failMessage = unavailableResources.length ? `Sync failed for: ${unavailableResources.join(', ')}` : 'No resources synced'

    return {
      success: isFullSuccess,
      data: {
        resourceCount: completedResources.length,
        synced: completedResources,
        failed: unavailableResources,
        skipped
      },
      error: isFullSuccess ? null : failMessage,
      message: isFullSuccess ? 'Batch sync completed' : (hasAnySuccess ? 'Partial sync completed' : failMessage),
      timestamp: Date.now()
    }
  } catch (error) {
    logger.error('Batch sync error', { error: error.message })
    if (syncNames.length) {
      options.resourceStatus?.markSyncFailed?.(syncNames, error.message)
    }
    return standardizeResponse(false, {}, error.message)
  }
}

export async function fetchResourceRecords(resourceName, authorizedResources = [], appConfig = {}, options = {}) {
  try {
    logger.debug('Fetching resource records', { resource: resourceName })

    const resourceStatus = options.resourceStatus || null
    if (resourceStatus?.isSyncing?.(resourceName)) {
      logger.debug('Skipping fetch; resource already syncing', { resource: resourceName })
      const cached = await readCachedResourcePayload(resourceName, authorizedResources, 'syncing-skip')
      cached.meta.confirmedFull = false
      cached.meta.isFallback = true
      return standardizeResponse(true, cached, 'Resource already syncing')
    }

    const headersResp = await ensureHeaders(resourceName, authorizedResources)
    if (!headersResp.success || !headersResp.data.length) {
      if (isResourceInAuthorizedList(resourceName, authorizedResources)) {
        logger.warn('Headers not available', { resource: resourceName })
      }
      return {
        success: false,
        data: {
          headers: [],
          rows: [],
          records: [],
          meta: {
            resource: resourceName,
            source: 'unavailable',
            skipped: false,
            timedOut: false,
            failed: true,
            validEmpty: false,
            isFallback: false,
            confirmedFull: false
          }
        },
        error: `Headers unavailable for ${resourceName}`,
        timestamp: Date.now()
      }
    }

    const headers = headersResp.data
    resourceStatus?.setHeaders?.(resourceName, headers)

    const metaResult = await withTimeoutDetailed(getResourceMeta(resourceName), null, `meta:${resourceName}`)
    const meta = metaResult.data
    resourceStatus?.applyResourceMeta?.(resourceName, meta || {})
    const syncCursor = normalizeCursorValue(meta?.lastDataUpdatedAt) || null
    const cacheRefreshedAt = getCacheRefreshedAt(meta)

    const rowsResult = await withTimeoutDetailed(getResourceRows(resourceName), [], `rows:${resourceName}`)
    const cachedRows = rowsResult.data
    const cacheTimedOut = metaResult.status === 'timeout' || rowsResult.status === 'timeout'
    const cacheFailed = metaResult.status === 'error' || rowsResult.status === 'error'

    const hasHydratedOnce = meta?.hasHydratedOnce === true
    const ttlSec = getResourceSyncTtl(resourceName, authorizedResources, appConfig)
    const ttlMs = ttlSec * 1000
    const emptyCacheThrottleMs = Math.max(0, ttlMs / 10)
    const isRecoveryTarget = Array.isArray(options.recoveryResources)
      ? options.recoveryResources.includes(resourceName)
      : (options.recoverMissing === true || options.forceRecovery === true)

    const emptyCacheFreshEnough =
      !isRecoveryTarget &&
      !cacheTimedOut &&
      !cacheFailed &&
      !cachedRows.length &&
      hasHydratedOnce &&
      cacheRefreshedAt &&
      emptyCacheThrottleMs > 0 &&
      isWithinTtl(cacheRefreshedAt, emptyCacheThrottleMs)

    if (emptyCacheFreshEnough) {
      logger.debug('Returning recently hydrated empty cache', { resource: resourceName })
      return {
        success: true,
        data: {
          headers,
          rows: [],
          records: [],
          meta: {
            resource: resourceName,
            source: 'cache-empty',
            lastSyncAt: normalizeCursorValue(meta?.lastSyncAt),
            lastDataUpdatedAt: syncCursor,
            lastFetchAt: cacheRefreshedAt,
            skipped: false,
            timedOut: false,
            failed: false,
            validEmpty: true,
            isFallback: false,
            confirmedFull: true
          }
        },
        error: null,
        timestamp: Date.now()
      }
    }

    const populatedCacheFreshEnough =
      !isRecoveryTarget &&
      !cacheTimedOut &&
      !cacheFailed &&
      cachedRows.length > 0 &&
      !options.forceSync &&
      isWithinTtl(cacheRefreshedAt, ttlMs)

    if (populatedCacheFreshEnough) {
      logger.debug('Returning cached rows', { resource: resourceName, count: cachedRows.length })
      return {
        success: true,
        data: {
          headers,
          rows: cachedRows,
          records: mapRowsToObjects(cachedRows, headers),
          meta: {
            resource: resourceName,
            source: 'cache',
            lastSyncAt: normalizeCursorValue(meta?.lastSyncAt),
            lastDataUpdatedAt: syncCursor,
            lastFetchAt: cacheRefreshedAt,
            skipped: false,
            timedOut: false,
            failed: false,
            validEmpty: false,
            isFallback: false,
            confirmedFull: true
          }
        },
        error: null,
        timestamp: Date.now()
      }
    }

    const isRecoveringMissing = options.recoverMissing === true || options.forceRecovery === true
    const isMissingCache = (!cacheTimedOut && !cacheFailed && !cachedRows.length && (hasHydratedOnce || !!syncCursor)) || isRecoveringMissing
    if (isMissingCache) {
      await withTimeout(setResourceMeta(resourceName, { lastSyncAt: null, lastDataUpdatedAt: null }), null, `recoverCache:${resourceName}`)
    }

    const hasUsableHydration = !cacheTimedOut && !cacheFailed && !isMissingCache && (hasHydratedOnce || !!syncCursor)
    const isManualReload = options.forceSync === true
    const shouldImmediateSync = !hasUsableHydration || isManualReload || isRecoveringMissing

    logger.debug('Determining sync strategy', { resource: resourceName, shouldSync: shouldImmediateSync })

    let syncAttempted = false
    let syncSuccess = false
    let syncError = ''

    if (shouldImmediateSync) {
      syncAttempted = true
      const batchSyncResponse = await syncResourcesBatch([resourceName], authorizedResources, appConfig, {
        showError: !cachedRows.length,
        showLoading: !cachedRows.length,
        forceSync: isManualReload || isMissingCache,
        recoverMissing: isRecoveringMissing,
        recoveryResources: options.recoveryResources,
        resourceStatus
      })

      if (batchSyncResponse.success) {
        syncSuccess = true
      } else {
        syncError = batchSyncResponse.error || `Failed to sync ${resourceName}`
      }
    }

    const freshRowsResult = await withTimeoutDetailed(getResourceRows(resourceName), [], `freshRows:${resourceName}`)
    const freshRows = freshRowsResult.data
    const freshTimedOut = freshRowsResult.status === 'timeout'
    const freshFailed = freshRowsResult.status === 'error'

    const latestMetaResult = await withTimeoutDetailed(getResourceMeta(resourceName), null, `latestMeta:${resourceName}`)
    const latestMeta = latestMetaResult.data

    logger.debug('Fetch completed', { resource: resourceName, rowCount: freshRows.length, cachedCount: cachedRows.length })

    const hasFreshRows = freshRows.length > 0
    const hasCachedRows = cachedRows.length > 0
    const effectiveRows = hasFreshRows ? freshRows : (hasCachedRows ? cachedRows : [])

    const timedOut = freshTimedOut || (syncAttempted && !syncSuccess && cacheTimedOut)
    const failed = (syncAttempted && !syncSuccess) || freshFailed || (cacheFailed && !hasFreshRows)

    const isFallback = (timedOut || failed) && hasCachedRows && !hasFreshRows
    const validEmpty = !effectiveRows.length && !timedOut && !failed && (syncSuccess || emptyCacheFreshEnough)
    const confirmedFull = !timedOut && !failed && !isFallback && (hasFreshRows || (hasCachedRows && !syncAttempted) || validEmpty)

    const isSuccess = !timedOut && !failed

    let source = 'cache'
    if (timedOut) source = 'cache-timeout'
    else if (failed) source = 'cache-error'
    else if (validEmpty) source = syncSuccess ? 'sync' : 'cache-empty'
    else if (hasFreshRows) source = syncSuccess ? 'sync' : 'cache'

    return {
      success: isSuccess,
      data: {
        headers,
        rows: effectiveRows,
        records: mapRowsToObjects(effectiveRows, headers),
        meta: {
          resource: resourceName,
          source,
          skipped: false,
          timedOut,
          failed,
          validEmpty,
          isFallback,
          confirmedFull,
          lastSyncAt: normalizeCursorValue(latestMeta?.lastSyncAt) || normalizeCursorValue(meta?.lastSyncAt),
          lastDataUpdatedAt: normalizeCursorValue(latestMeta?.lastDataUpdatedAt) || syncCursor,
          lastFetchAt: getCacheRefreshedAt(latestMeta) || cacheRefreshedAt
        }
      },
      error: isSuccess ? null : (syncError || (timedOut ? `Cache read timed out for ${resourceName}` : `Failed to load ${resourceName}`)),
      timestamp: Date.now()
    }
  } catch (error) {
    logger.error('Fetch failed', { resource: resourceName, error: error.message })
    return {
      success: false,
      data: {
        headers: [],
        rows: [],
        records: [],
        meta: {
          resource: resourceName,
          source: 'error',
          skipped: false,
          timedOut: false,
          failed: true,
          validEmpty: false,
          isFallback: false,
          confirmedFull: false
        }
      },
      error: error.message,
      timestamp: Date.now()
    }
  }
}

export async function fetchResourceRecordsBatch(resourceNames = [], authorizedResources = [], appConfig = {}, options = {}) {
  try {
    const uniqueNames = Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : [resourceNames]).filter(Boolean)))
    if (!uniqueNames.length) {
      return standardizeResponse(true, { resources: {}, synced: [] }, 'No resources requested')
    }

    const resourceStatus = options.resourceStatus || null
    let skipped = resourceStatus
      ? uniqueNames.filter((resourceName) => resourceStatus.isSyncing(resourceName))
      : []
    const availableNames = uniqueNames.filter((resourceName) => !skipped.includes(resourceName))
    const now = Date.now()
    const stateByResource = {}
    const syncNames = []
    let syncedNames = []
    let failedNames = []
    const resources = {}
    const errors = []

    for (const resourceName of skipped) {
      resources[resourceName] = await readCachedResourcePayload(resourceName, authorizedResources, 'syncing-skip')
    }

    for (const resourceName of availableNames) {
      const headersResp = await ensureHeaders(resourceName, authorizedResources)
      if (!headersResp.success || !headersResp.data.length) {
        const message = `Headers unavailable for ${resourceName}`
        errors.push(message)
        resources[resourceName] = {
          headers: [],
          rows: [],
          records: [],
          meta: {
            resource: resourceName,
            source: 'unavailable',
            stale: true,
            failed: true,
            skipped: false,
            timedOut: false,
            validEmpty: false
          }
        }
        continue
      }

      const headers = headersResp.data
      resourceStatus?.setHeaders?.(resourceName, headers)
      const metaResult = await withTimeoutDetailed(getResourceMeta(resourceName), null, `meta:${resourceName}`)
      const meta = metaResult.data
      resourceStatus?.applyResourceMeta?.(resourceName, meta || {})
      const syncCursor = normalizeCursorValue(meta?.lastDataUpdatedAt) || null
      const cacheRefreshedAt = getCacheRefreshedAt(meta)
      const rowsResult = await withTimeoutDetailed(getResourceRows(resourceName), [], `rows:${resourceName}`)
      const cachedRows = rowsResult.data
      const cacheTimedOut = metaResult.status === 'timeout' || rowsResult.status === 'timeout'
      const cacheFailed = metaResult.status === 'error' || rowsResult.status === 'error'

      const hasHydratedOnce = meta?.hasHydratedOnce === true
      let effectiveCursor = syncCursor ?? null
      if (!cachedRows.length && effectiveCursor && !hasHydratedOnce) {
        effectiveCursor = null
      }

      const isRecoveryTarget = Array.isArray(options.recoveryResources)
        ? options.recoveryResources.includes(resourceName)
        : (options.recoverMissing === true || options.forceRecovery === true)

      const ttlSec = getResourceSyncTtl(resourceName, authorizedResources, appConfig)
      const ttlMs = ttlSec * 1000
      const emptyCacheThrottleMs = Math.max(0, ttlMs / 10)
      const emptyCacheFreshEnough =
        !isRecoveryTarget &&
        !cacheTimedOut &&
        !cacheFailed &&
        !cachedRows.length &&
        hasHydratedOnce &&
        cacheRefreshedAt &&
        emptyCacheThrottleMs > 0 &&
        now < cacheRefreshedAt + emptyCacheThrottleMs

      const hasUsableHydration = !isRecoveryTarget && !cacheTimedOut && !cacheFailed && (hasHydratedOnce || !!effectiveCursor)
      const isManualReload = options.forceSync === true
      const shouldSync = !hasUsableHydration || isManualReload || isRecoveryTarget

      if (shouldSync) {
        syncNames.push(resourceName)
      }

      stateByResource[resourceName] = {
        headers,
        cachedRows,
        syncCursor,
        effectiveCursor,
        cacheRefreshedAt,
        hasHydratedOnce,
        emptyCacheFreshEnough,
        cacheTimedOut,
        cacheFailed
      }
    }

    if (syncNames.length) {
      for (const resourceName of syncNames) {
        const state = stateByResource[resourceName]
        if (!state?.cachedRows?.length && state?.syncCursor && !state.hasHydratedOnce && !state.cacheTimedOut) {
          await withTimeout(setResourceMeta(resourceName, { lastSyncAt: null }), null, `resetCursor:${resourceName}`)
        }
      }

      const syncResponse = await syncResourcesBatch(syncNames, authorizedResources, appConfig, {
        showError: options.showError === true,
        showLoading: options.showLoading === true,
        forceSync: options.forceSync === true,
        recoverMissing: options.recoverMissing === true,
        recoveryResources: options.recoveryResources,
        resourceStatus
      })

      const batchSynced = Array.isArray(syncResponse.data?.synced) ? syncResponse.data.synced : []
      const batchFailed = Array.isArray(syncResponse.data?.failed) ? syncResponse.data.failed : []
      const batchSkipped = Array.isArray(syncResponse.data?.skipped) ? syncResponse.data.skipped : []

      syncedNames = Array.from(new Set([...syncedNames, ...batchSynced]))
      failedNames = Array.from(new Set([...failedNames, ...batchFailed]))
      skipped = Array.from(new Set([...skipped, ...batchSkipped]))

      if (!syncResponse.success) {
        errors.push(syncResponse.error || syncResponse.message || 'Failed to sync resources')
        for (const name of syncNames) {
          if (!syncedNames.includes(name) && !failedNames.includes(name)) {
            failedNames.push(name)
          }
        }
      }
    }

    for (const resourceName of availableNames) {
      const state = stateByResource[resourceName]
      if (!state) continue

      const metaResult = await withTimeoutDetailed(getResourceMeta(resourceName), null, `meta:${resourceName}`)
      const meta = metaResult.data
      const freshRowsResult = await withTimeoutDetailed(getResourceRows(resourceName), [], `freshRows:${resourceName}`)
      const freshRows = freshRowsResult.data
      const freshTimedOut = freshRowsResult.status === 'timeout'
      const freshFailed = freshRowsResult.status === 'error'

      const hasFreshRows = freshRows.length > 0
      const hasCachedRows = (state.cachedRows || []).length > 0
      const rows = hasFreshRows ? freshRows : (hasCachedRows ? state.cachedRows : [])
      const lastSyncAt = normalizeCursorValue(meta?.lastSyncAt) || null
      const lastDataUpdatedAt = normalizeCursorValue(meta?.lastDataUpdatedAt) || state.effectiveCursor || null
      const lastFetchAt = getCacheRefreshedAt(meta) || state.cacheRefreshedAt || null

      const isResourceSkipped = skipped.includes(resourceName)
      const wasSynced = syncedNames.includes(resourceName)

      const timedOut = freshTimedOut || (syncNames.includes(resourceName) && !wasSynced && state.cacheTimedOut)
      const failed = (syncNames.includes(resourceName) && !wasSynced) || freshFailed || (state.cacheFailed && !hasFreshRows)

      const isFallback = (timedOut || failed) && hasCachedRows && !hasFreshRows
      const validEmpty = !rows.length && !timedOut && !failed && (wasSynced || state.emptyCacheFreshEnough)
      const confirmedFull = !timedOut && !failed && !isFallback && (hasFreshRows || (hasCachedRows && !syncNames.includes(resourceName)) || validEmpty)

      let source = 'cache'
      if (isResourceSkipped) source = 'syncing-skip'
      else if (timedOut) source = 'cache-timeout'
      else if (failed) source = 'cache-error'
      else if (validEmpty) source = wasSynced ? 'sync' : 'cache-empty'
      else if (wasSynced) source = 'sync'

      resources[resourceName] = {
        headers: state.headers,
        rows,
        records: mapRowsToObjects(rows, state.headers),
        meta: {
          resource: resourceName,
          source,
          skipped: isResourceSkipped,
          timedOut,
          failed,
          validEmpty,
          isFallback,
          confirmedFull,
          lastSyncAt,
          lastDataUpdatedAt,
          lastFetchAt
        }
      }
    }

    const hasErrors = errors.length > 0 || failedNames.length > 0
    if (!hasErrors) {
      return standardizeResponse(true, {
        resources,
        synced: syncedNames,
        failed: [],
        skipped
      }, null)
    }

    return {
      success: false,
      partial: syncedNames.length > 0,
      data: {
        resources,
        synced: syncedNames,
        failed: failedNames,
        skipped
      },
      error: errors.join('; ') || `Failed to sync: ${failedNames.join(', ')}`,
      message: errors.join('; ') || `Failed to sync: ${failedNames.join(', ')}`,
      timestamp: Date.now()
    }
  } catch (error) {
    logger.error('Batch fetch failed', { error: error.message })
    return standardizeResponse(false, { resources: {}, synced: [] }, error.message)
  }
}

export async function createRecord(resourceName, record) {
  try {
    logger.debug('Creating record', { resource: resourceName })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([resourceName])
    const response = await executeGasApi('create', {
      resource: resourceName,
      record,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Record created', { resource: resourceName })
    }
    return response
  } catch (error) {
    logger.error('Create failed', { resource: resourceName, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function updateRecord(resourceName, code, record) {
  try {
    logger.debug('Updating record', { resource: resourceName, code })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([resourceName])
    const response = await executeGasApi('update', {
      resource: resourceName,
      code,
      record,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Record updated', { resource: resourceName, code })
    }
    return response
  } catch (error) {
    logger.error('Update failed', { resource: resourceName, code, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function bulkRecords(targetResourceName, records) {
  try {
    logger.debug('Bulk upload', { resource: targetResourceName, count: records?.length || 0 })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([targetResourceName])
    const response = await executeGasApi('bulk', {
      resource: targetResourceName,
      targetResource: targetResourceName,
      records,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Bulk upload success', { resource: targetResourceName })
    }
    return response
  } catch (error) {
    logger.error('Bulk upload failed', { resource: targetResourceName, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function compositeSave(payload) {
  try {
    const parentResource = normalizeName(payload?.resource)
    const childResources = Array.isArray(payload?.children)
      ? payload.children.map((entry) => normalizeName(entry?.resource)).filter(Boolean)
      : []
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([parentResource, ...childResources])
    logger.debug('Composite save', { resource: parentResource, childResources: childResources.length })
    const response = await executeGasApi('compositeSave', {
      ...payload,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Composite save success')
    }
    return response
  } catch (error) {
    logger.error('Composite save failed', { error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function executeAction(resourceName, code, actionConfig, fields = {}) {
  try {
    logger.debug('Executing action', { resource: resourceName, action: actionConfig.action, code })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([resourceName])
    const response = await executeGasApi('executeAction', {
      resource: resourceName,
      code,
      actionName: actionConfig.action,
      column: actionConfig.column,
      columnValue: actionConfig.columnValue,
      fields,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Action executed', { resource: resourceName, action: actionConfig.action })
    }
    return response
  } catch (error) {
    logger.error('Action failed', { resource: resourceName, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function runBatchRequests(requests = []) {
  try {
    const resourceNames = collectBatchCursorResources(requests)
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource(resourceNames)
    const scopedRequests = requests.map((request) => {
      const payload = { ...(request.payload || {}) }
      delete payload.lastUpdatedAtResources
      return {
        ...request,
        payload: { ...payload, lastUpdatedAtByResource }
      }
    })

    const response = await executeGasApi('batch', { requests: scopedRequests })
    const responses = Array.isArray(response?.data?.result?.responses)
      ? response.data.result.responses
      : []
    const resourcePayload = response?.data?.resources && typeof response.data.resources === 'object'
      ? response.data.resources
      : {}

    const failedPersist = []
    for (const [resourceName, resourceData] of Object.entries(resourcePayload)) {
      const ok = await persistBatchResourcePayload(resourceName, resourceData)
      if (!ok) failedPersist.push(resourceName)
    }
    const allPersisted = failedPersist.length === 0

    return {
      success: response?.success === true && allPersisted,
      data: responses,
      resources: resourcePayload,
      failedPersist,
      error: response?.success === true && allPersisted ? null : (failedPersist.length ? `Failed to persist: ${failedPersist.join(', ')}` : (response?.error || response?.message || 'Batch request failed')),
      message: response?.message || ''
    }
  } catch (error) {
    logger.error('Batch request failed', { error: error.message })
    return standardizeResponse(false, [], error.message)
  }
}

export async function generateReport(payload = {}) {
  return executeGasApi('generateReport', payload)
}

function clearQueueTimer() {
  if (queueTimerId) {
    clearTimeout(queueTimerId)
    queueTimerId = null
  }
}

function scheduleResourceSyncQueueFlush() {
  clearQueueTimer()
  if (!resourceSyncQueue.size) return

  let nextDueAt = Number.POSITIVE_INFINITY
  for (const queued of resourceSyncQueue.values()) {
    const dueAt = Number(queued?.dueAt || 0)
    if (dueAt > 0 && dueAt < nextDueAt) {
      nextDueAt = dueAt
    }
  }

  const waitMs = Number.isFinite(nextDueAt)
    ? Math.max(nextDueAt - Date.now(), MIN_QUEUE_WAIT_MS)
    : MIN_QUEUE_WAIT_MS
  queueTimerId = setTimeout(() => {
    flushResourceSyncQueue({ showError: false, showLoading: false }).catch(() => {})
  }, waitMs)
}

export function registerQueuedSyncHandler(syncHandler) {
  queuedSyncHandler = typeof syncHandler === 'function' ? syncHandler : null
}

export function queueResourceSync(resourceName, dueAt, reason = '') {
  if (!resourceName) return
  if (inFlightResourceNames.has(resourceName)) return
  const normalizedDueAt = Number.isFinite(Number(dueAt)) ? Number(dueAt) : Date.now()
  const existing = resourceSyncQueue.get(resourceName)
  if (!existing || normalizedDueAt < existing.dueAt) {
    resourceSyncQueue.set(resourceName, {
      dueAt: normalizedDueAt,
      reason
    })
  }
  scheduleResourceSyncQueueFlush()
}

export async function flushResourceSyncQueue(syncOptions = {}) {
  if (queueFlushPromise) {
    const result = await queueFlushPromise
    if (resourceSyncQueue.size > 0) {
      return flushResourceSyncQueue(syncOptions)
    }
    return result
  }

  queueFlushPromise = (async () => {
    const now = Date.now()
    const dueResourceNames = []

    for (const [resourceName, queued] of resourceSyncQueue.entries()) {
      if ((queued?.dueAt || 0) <= now) {
        dueResourceNames.push(resourceName)
      }
    }

    if (!dueResourceNames.length) {
      scheduleResourceSyncQueueFlush()
      return { success: true, data: {}, meta: { resources: [] } }
    }

    dueResourceNames.forEach((resourceName) => {
      resourceSyncQueue.delete(resourceName)
      inFlightResourceNames.add(resourceName)
    })

    try {
      if (!queuedSyncHandler) {
        return standardizeResponse(false, {}, 'Resource sync handler is not registered')
      }
      const response = await queuedSyncHandler(dueResourceNames, {
        showError: syncOptions.showError === true,
        showLoading: syncOptions.showLoading === true
      })
      scheduleResourceSyncQueueFlush()
      return response
    } finally {
      dueResourceNames.forEach((name) => inFlightResourceNames.delete(name))
    }
  })().finally(() => {
    queueFlushPromise = null
  })

  return queueFlushPromise
}

export async function initializeDb() {
  return dbInitialize()
}

export async function setAuthorizedResources(resources = [], resetCursors = false) {
  return authorizedResourcesSet(resources, resetCursors)
}

export async function clearAllStorage() {
  return storagesClear()
}

export async function getAllResourceMetaCached() {
  return metaGetAll()
}

export async function getResourceMetaCached(resource) {
  return metaGet(resource)
}

export async function setResourceMetaCached(resource, meta) {
  return metaSet(resource, meta)
}

export async function getResourceRowsCached(resource, options = {}) {
  return rowsGet(resource, options)
}

export async function upsertResourceRowsCached(resource, headers = [], rows = []) {
  return rowsUpsert(resource, headers, rows)
}

export async function getDraft(key) {
  return draftGet(key)
}

export async function saveDraft(key, data) {
  return draftSave(key, data)
}

export async function deleteDraft(key) {
  return draftDelete(key)
}
