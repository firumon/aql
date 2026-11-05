const JSON_MIME_TYPE = ContentService.MimeType.JSON;
let _activeBatchWritePlan = null;

function doPost(e) {
  var request;
  var result = { success: false, message: 'Invalid request' };

  try {
    request = normalizeIncomingRequest(parseRequestPayload(e));
    var action = (request.action || '').toString().trim();

    if (!action) {
      return jsonResponse(buildErrorEnvelope(request, 'Action is required'));
    }

    // Public actions
    if (action === 'login') {
      result = handleLogin(request.payload.email, request.payload.password);
      return jsonResponse(buildApiEnvelope(request, result));
    }

    // Protected actions
    // The session proof carries the full auth context, so a verified request
    // needs no user lookup at all.
    var proof = verifySessionProof(request.token, request.sessionKey);
    if (!proof.ok) {
      return jsonResponse(buildErrorEnvelope(request, 'Unauthorized / ' + proof.message, proof.resync));
    }

    var authContext = proof.auth;
    authContext.token = request.token;

    result = dispatchProtectedAction(action, authContext, request.payload);
  } catch (err) {
    if (!request) {
      request = {
        requestId: Utilities.getUuid(),
        action: '',
        resource: '',
        payload: {},
        token: '',
        sessionKey: ''
      };
    }
    return jsonResponse(buildErrorEnvelope(request, err && err.message ? err.message : String(err)));
  } finally {
    // Read paths queue sync-cursor bumps instead of writing one CacheService key
    // at a time. Flush them as a single batch, on every exit path including the
    // early returns above.
    try {
      if (typeof flushPendingCursorWrites === 'function') flushPendingCursorWrites();
    } catch (flushErr) { /* never let a cache flush break the response */ }
  }

  return jsonResponse(buildApiEnvelope(request, result));
}

function normalizeIncomingRequest(raw) {
  var source = raw || {};
  var requestId = (source.requestId || '').toString().trim() || Utilities.getUuid();
  var action = (source.action || '').toString().trim();
  var token = (source.token || '').toString().trim();
  var sessionKey = (source.sessionKey || '').toString().trim();
  var mergedPayload = mergePayloadWithTopLevel(source, action);
  var resource = normalizeResourceSelector(
    mergedPayload.resource !== undefined ? mergedPayload.resource : source.resource
  );

  if (resource !== '' && resource !== null && resource !== undefined) {
    mergedPayload.resource = resource;
  }
  if (Array.isArray(resource)) {
    mergedPayload.resources = resource;
  }

  if (action === 'batch') {
    var requests = Array.isArray(mergedPayload.requests) ? mergedPayload.requests : [];
    mergedPayload.requests = requests.map(function (entry) {
      return normalizeBatchSubRequest(entry);
    });
    var formTicket = normalizeFormTicket(
      mergedPayload.formTicket !== undefined ? mergedPayload.formTicket : source.formTicket
    );
    if (formTicket) mergedPayload.formTicket = formTicket;
    else delete mergedPayload.formTicket;
  }

  return {
    requestId: requestId,
    action: action,
    token: token,
    sessionKey: sessionKey,
    resource: resource,
    payload: mergedPayload
  };
}

// Cache keys have a length cap, so a long or odd ticket is rejected rather than
// silently truncated into a key that could collide with another form.
function normalizeFormTicket(raw) {
  var ticket = (raw === null || raw === undefined ? '' : raw).toString().trim();
  if (!ticket || ticket.length > 100) return '';
  return /^[A-Za-z0-9_-]+$/.test(ticket) ? ticket : '';
}

function normalizeBatchSubRequest(raw) {
  var source = raw || {};
  var action = (source.action || '').toString().trim();
  var mergedPayload = mergePayloadWithTopLevel(source, action);
  var resource = normalizeResourceSelector(
    mergedPayload.resource !== undefined ? mergedPayload.resource : source.resource
  );
  if (resource !== '' && resource !== null && resource !== undefined) {
    mergedPayload.resource = resource;
  }
  if (Array.isArray(resource)) {
    mergedPayload.resources = resource;
  }

  var normalized = {};
  Object.keys(mergedPayload).forEach(function (key) {
    normalized[key] = mergedPayload[key];
  });
  normalized.requestId = (source.requestId || '').toString().trim() || Utilities.getUuid();
  normalized.action = action;
  if (resource !== '' && resource !== null && resource !== undefined) {
    normalized.resource = resource;
  }
  return normalized;
}

function mergePayloadWithTopLevel(source, action) {
  if (requiresStrictNestedPayload(action)) {
    validateStrictNestedPayload(source, action);
    return clonePayloadObject(source.payload || {});
  }

  var payload = {};
  if (source && source.payload && typeof source.payload === 'object' && !Array.isArray(source.payload)) {
    Object.keys(source.payload).forEach(function (key) {
      payload[key] = source.payload[key];
    });
  }

  var reserved = {
    requestId: true,
    action: true,
    token: true,
    sessionKey: true,
    payload: true
  };
  Object.keys(source || {}).forEach(function (key) {
    if (reserved[key]) return;
    if (payload[key] === undefined) {
      payload[key] = source[key];
    }
  });
  return payload;
}

function requiresStrictNestedPayload(action) {
  var normalized = (action || '').toString().trim().toLowerCase();
  return normalized === 'create'
    || normalized === 'update'
    || normalized === 'bulk'
    || normalized === 'record'
    || normalized === 'compositesave'
    || normalized === 'executeaction';
}

function validateStrictNestedPayload(source, action) {
  if (!source || typeof source.payload !== 'object' || Array.isArray(source.payload)) {
    throw new Error(action + ' requires a nested payload object');
  }

  var reservedTopLevel = {
    requestId: true,
    action: true,
    token: true,
    sessionKey: true,
    payload: true,
    resource: true,
    scope: true
  };

  var topLevelKeys = Object.keys(source || {});
  for (var i = 0; i < topLevelKeys.length; i++) {
    var key = topLevelKeys[i];
    if (!reservedTopLevel[key]) {
      throw new Error(action + ' does not allow top-level field "' + key + '"; use payload.' + key);
    }
  }
}

function clonePayloadObject(payload) {
  var cloned = {};
  Object.keys(payload || {}).forEach(function (key) {
    cloned[key] = payload[key];
  });
  return cloned;
}

function normalizeResourceSelector(resource) {
  if (Array.isArray(resource)) {
    var list = resource
      .map(function (item) { return (item || '').toString().trim(); })
      .filter(Boolean);
    return list.length ? list : '';
  }
  if (resource === null || resource === undefined) return '';
  var normalized = resource.toString().trim();
  return normalized || '';
}

function buildErrorEnvelope(request, message, sessionResync) {
  var envelope = {
    success: false,
    requestId: request && request.requestId ? request.requestId : Utilities.getUuid(),
    action: request && request.action ? request.action : '',
    error: message || 'Request failed',
    message: message || 'Request failed',
    data: {
      resources: {},
      result: {},
      artifacts: {}
    },
    meta: {
      serverTime: Date.now(),
      version: 'v1'
    }
  };
  if (sessionResync) {
    envelope.sessionResync = sessionResync;
  }
  return envelope;
}

function buildApiEnvelope(request, rawResult) {
  var success = !!(rawResult && rawResult.success === true);
  var message = rawResult && rawResult.message ? rawResult.message : '';
  var error = success ? null : (rawResult && (rawResult.error || rawResult.message) ? (rawResult.error || rawResult.message) : 'Request failed');
  var normalizedData = normalizeActionData(
    request && request.action ? request.action : '',
    request && request.resource,
    request && request.payload ? request.payload : {},
    rawResult || {}
  );

  return {
    success: success,
    requestId: request && request.requestId ? request.requestId : Utilities.getUuid(),
    action: request && request.action ? request.action : '',
    error: error,
    message: message,
    data: normalizedData,
    meta: {
      serverTime: Date.now(),
      version: 'v1'
    }
  };
}

function normalizeActionData(action, requestResource, requestPayload, rawResult) {
  let resources = {};
  let result = {};
  let artifacts = {};

  if (action === 'batch') {
    let requests = Array.isArray(requestPayload && requestPayload.requests) ? requestPayload.requests : [];
    let rawItems = Array.isArray(rawResult && rawResult.data) ? rawResult.data : [];
    result.responses = rawItems.map(function (entry, index) {
      let subReq = requests[index] || {};
      let normalizedReq = {
        requestId: subReq.requestId || Utilities.getUuid(),
        action: (subReq.action || '').toString().trim(),
        resource: subReq.resource || '',
        payload: subReq
      };
      let envelope = buildApiEnvelope(normalizedReq, entry || { success: false, message: 'Empty batch item result' });
      mergeResourcePayloadMap(resources, envelope && envelope.data ? envelope.data.resources : {});
      if (envelope && envelope.data && envelope.data.resources) {
        delete envelope.data.resources;
      }
      return envelope;
    });

    ['retryUnsafe', 'committedFiles', 'unconfirmedFile', 'inProgress', 'replayed'].forEach(function(key) {
      if (rawResult && rawResult[key] !== undefined) result[key] = rawResult[key];
    });
    let deltas = rawResult && rawResult.deltaResources;
    if (deltas && typeof deltas === 'object') {
      let deltaPayloads = {};
      Object.keys(deltas).forEach(function (resourceName) {
        let delta = deltas[resourceName];
        if (!delta || !Array.isArray(delta.rows)) return;
        deltaPayloads[resourceName] = buildResourcePayload(
          resourceName, delta.rows, delta.meta, delta.headers, requestPayload
        );
      });
      mergeResourcePayloadMap(resources, deltaPayloads);
    }
    return { resources: resources, result: result, artifacts: {} };
  }

  extractResourcePayloads(resources, requestResource, rawResult, requestPayload);

  let topLevelResultKeys = ['token', 'user', 'resources', 'appConfig', 'avatarUrl', 'name', 'email', 'archived'];
  topLevelResultKeys.forEach(function (key) {
    if (rawResult && rawResult[key] !== undefined) {
      result[key] = rawResult[key];
    }
  });

  if (rawResult && Array.isArray(rawResult.errors)) {
    result.errors = rawResult.errors;
  }

  let data = rawResult ? rawResult.data : null;
  if (data !== null && data !== undefined) {
    if (typeof data === 'object' && !Array.isArray(data)) {
      let sanitized = stripResourceFields(data);
      Object.keys(sanitized).forEach(function (key) {
        result[key] = sanitized[key];
      });
    } else {
      result.value = data;
    }
  }

  if (rawResult && rawResult.base64) {
    artifacts.report = {
      base64: rawResult.base64,
      fileName: rawResult.fileName || '',
      mimeType: rawResult.mimeType || 'application/pdf'
    };
  }

  return {
    resources: resources,
    result: result,
    artifacts: artifacts
  };
}

function mergeResourcePayloadMap(target, source) {
  var destination = target && typeof target === 'object' ? target : {};
  var incoming = source && typeof source === 'object' ? source : {};

  Object.keys(incoming).forEach(function (resourceName) {
    var inPayload = incoming[resourceName];
    if (!inPayload || typeof inPayload !== 'object') return;

    var destPayload = destination[resourceName];
    if (!destPayload || typeof destPayload !== 'object') {
      destination[resourceName] = inPayload;
      return;
    }

    var destHeaders = Array.isArray(destPayload.headers) ? destPayload.headers : [];
    var inHeaders = Array.isArray(inPayload.headers) ? inPayload.headers : [];
    var headers = inHeaders.length >= destHeaders.length ? inHeaders : destHeaders;

    var destCodeIdx = destHeaders.indexOf('Code');
    var inCodeIdx = inHeaders.indexOf('Code');
    if (destCodeIdx === -1) destCodeIdx = inCodeIdx;
    if (inCodeIdx === -1) inCodeIdx = destCodeIdx;

    var destRows = Array.isArray(destPayload.rows) ? destPayload.rows : [];
    var inRows = Array.isArray(inPayload.rows) ? inPayload.rows : [];

    var mergedRows = [];
    if (!destRows.length && !inRows.length) {
      mergedRows = [];
    } else if (!destRows.length) {
      mergedRows = inRows.slice();
    } else if (!inRows.length) {
      mergedRows = destRows.slice();
    } else if (destCodeIdx === -1 && inCodeIdx === -1) {
      mergedRows = destRows.concat(inRows);
    } else {
      var codeMap = {};
      destRows.forEach(function (row) {
        if (!Array.isArray(row)) return;
        var code = destCodeIdx !== -1 ? (row[destCodeIdx] || '').toString().trim() : '';
        if (code) codeMap[code] = mergedRows.length;
        mergedRows.push(row);
      });

      inRows.forEach(function (row) {
        if (!Array.isArray(row)) return;
        var code = inCodeIdx !== -1 ? (row[inCodeIdx] || '').toString().trim() : '';
        if (code && codeMap[code] !== undefined) {
          mergedRows[codeMap[code]] = row;
        } else {
          if (code) codeMap[code] = mergedRows.length;
          mergedRows.push(row);
        }
      });
    }

    var destMeta = destPayload.meta && typeof destPayload.meta === 'object' ? destPayload.meta : {};
    var inMeta = inPayload.meta && typeof inPayload.meta === 'object' ? inPayload.meta : {};

    var destDataUpdated = typeof normalizeUpdatedAtMillis === 'function' ? normalizeUpdatedAtMillis(destMeta.lastDataUpdatedAt) : (Number(destMeta.lastDataUpdatedAt) || 0);
    var inDataUpdated = typeof normalizeUpdatedAtMillis === 'function' ? normalizeUpdatedAtMillis(inMeta.lastDataUpdatedAt) : (Number(inMeta.lastDataUpdatedAt) || 0);
    var mergedDataUpdated = Math.max(destDataUpdated, inDataUpdated);

    var destSyncAt = typeof normalizeUpdatedAtMillis === 'function' ? normalizeUpdatedAtMillis(destMeta.lastSyncAt) : (Number(destMeta.lastSyncAt) || 0);
    var inSyncAt = typeof normalizeUpdatedAtMillis === 'function' ? normalizeUpdatedAtMillis(inMeta.lastSyncAt) : (Number(inMeta.lastSyncAt) || 0);
    var mergedSyncAt = Math.max(destSyncAt, inSyncAt, Date.now());

    var mergedMeta = Object.assign({}, destMeta, inMeta, {
      lastDataUpdatedAt: mergedDataUpdated,
      lastSyncAt: mergedSyncAt
    });

    destination[resourceName] = {
      success: inPayload.success !== false && destPayload.success !== false,
      rows: mergedRows,
      headers: headers,
      meta: mergedMeta
    };
  });
}

function extractResourcePayloads(target, requestResource, rawResult, requestPayload) {
  if (!rawResult || typeof rawResult !== 'object') return;

  if (Array.isArray(rawResult.rows)) {
    var singleName = resolveRequestedResourceName(requestResource, rawResult.meta);
    if (singleName) {
      target[singleName] = buildResourcePayload(singleName, rawResult.rows, rawResult.meta, null, requestPayload);
    }
  }

  var data = rawResult.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return;
  }

  if (Array.isArray(data.rows)) {
    var dataName = resolveRequestedResourceName(requestResource, data.meta || rawResult.meta);
    if (dataName) {
      target[dataName] = buildResourcePayload(dataName, data.rows, data.meta || rawResult.meta, data.headers, requestPayload);
    }
  }

  if (data.resources && typeof data.resources === 'object' && !Array.isArray(data.resources)) {
    Object.keys(data.resources).forEach(function (resourceName) {
      var resourcePayload = data.resources[resourceName];
      if (resourcePayload && typeof resourcePayload === 'object' && Array.isArray(resourcePayload.rows)) {
        target[resourceName] = buildResourcePayload(resourceName, resourcePayload.rows, resourcePayload.meta, resourcePayload.headers, requestPayload);
      }
    });
  }

  Object.keys(data).forEach(function (key) {
    var value = data[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;

    if (Array.isArray(value.rows)) {
      target[key] = buildResourcePayload(key, value.rows, value.meta, value.headers, requestPayload);
      return;
    }

    if (value.success === true && Array.isArray(value.rows)) {
      target[key] = buildResourcePayload(key, value.rows, value.meta, value.headers, requestPayload);
    }
  });
}

function resolveRequestedResourceName(requestResource, meta) {
  if (meta && meta.resource) {
    return (meta.resource || '').toString().trim();
  }
  if (Array.isArray(requestResource)) {
    return requestResource.length ? requestResource[0] : '';
  }
  return (requestResource || '').toString().trim();
}

function buildResourcePayload(resourceName, rows, meta, headers, requestPayload) {
  var payload = {
    rows: Array.isArray(rows) ? rows : [],
    meta: meta && typeof meta === 'object' ? meta : { resource: resourceName, lastSyncAt: Date.now() }
  };

  var includeHeaders = !!(requestPayload && requestPayload.includeHeaders === true);
  if (includeHeaders && Array.isArray(headers) && headers.length) {
    payload.headers = headers;
  }
  return payload;
}

function stripResourceFields(data) {
  var result = {};
  Object.keys(data || {}).forEach(function (key) {
    if (key === 'rows' || key === 'headers' || key === 'meta' || key === 'resources') {
      return;
    }
    var value = data[key];
    if (value && typeof value === 'object' && Array.isArray(value.rows)) {
      return;
    }
    if (value && typeof value === 'object' && value.success === true && Array.isArray(value.rows)) {
      return;
    }
    result[key] = value;
  });
  return result;
}

function dispatchProtectedAction(action, auth, data) {
  if (isGenericCrudAction(action, data)) {
    return dispatchResourceCrudAction(action, auth, data);
  }

  switch (action) {
    // Generic batch action processing
    case 'batch':
      return handleBatchActions(auth, data);

    // Auth/Profile scope
    case 'getProfile':
      return handleGetProfile(auth);
    case 'updateAvatar':
      return handleUpdateAvatar(auth, data.avatarUrl);
    case 'updateName':
      return handleUpdateName(auth, data.name);
    case 'updateEmail':
      return handleUpdateEmail(auth, data.email);
    case 'updatePassword':
      return handleUpdatePassword(auth, data.currentPassword, data.newPassword);
    case 'getAuthorizedResources':
      return handleGetAuthorizedResources(auth, data);

    // Resource scope
    case 'master.health':
      return handleResourceHealth(auth);

    // Composite save (parent + children atomic)
    case 'compositeSave':
      return handleCompositeSave(auth, data);

    // Record-level multi-resource fetch
    case 'record':
      return handleResourceRecordFetch(auth, data);

    // Additional action execution (Approve, Reject, etc.)
    case 'executeAction':
      return handleExecuteAction(auth, data);

    // Polling action for resource updates
    case 'poll':
      return handlePollAction(auth, data);

    // Archive action
    case 'archive':
      return handleArchive(auth, data);

    // Report scope
    case 'generateReport':
      return generateReportPdf(auth, data);

    default:
      if (isCanonicalCrudVerb(action)) {
        return { success: false, message: 'Invalid canonical CRUD payload: resource selector is required' };
      }
      return { success: false, message: 'Action not found' };
  }
}

function isCanonicalCrudVerb(action) {
  var normalized = (action || '').toString().trim().toLowerCase();
  return normalized === 'get' || normalized === 'create' || normalized === 'update' || normalized === 'bulk';
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(JSON_MIME_TYPE);
}

function parseRequestPayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Empty request body');
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (parseErr) {
    throw new Error('Malformed JSON payload: ' + parseErr.message);
  }
}

var FT_CACHE_TTL_SECONDS = 1800;
var FT_STALE_HEARTBEAT_MS = 45000;
var FT_POLL_INTERVAL_MS = 2500;
var FT_POLL_CEILING_MS = 20000;

function handleBatchActions(auth, payload) {
  let requests = Array.isArray(payload.requests) ? payload.requests : [];
  if (!requests.length) {
    return { success: false, message: 'No requests provided for batch action' };
  }

  let formTicket = normalizeFormTicket(payload.formTicket);
  if (!formTicket) {
    return runBatchQueue(auth, payload, requests, null, null, null);
  }

  const requestHash = Utilities.base64Encode(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, JSON.stringify([auth && auth.user ? auth.user.UserID : '', requests])
  ));
  let cacheKey = 'FT_' + formTicket;
  let cache = openScriptCache();
  let state = cache ? readFormTicketState(cache, cacheKey, requests.length) : null;

  if (!state) {
    state = createFormTicketState(requests);
    state.requestHash = requestHash;
    writeFormTicketState(cache, cacheKey, state);
    return runBatchQueue(auth, payload, requests, cache, cacheKey, state);
  }

  if (state.requestHash && state.requestHash !== requestHash) {
    return { success: false, retryUnsafe: true, message: 'This save ticket belongs to another submission.', data: [] };
  }
  if (state.finished) {
    return buildFormTicketReplayResult(auth, payload, requests, state);
  }

  if (state.phase === 'committing' || state.phase === 'review' || state.completed.length) {
    return {
      success: false, retryUnsafe: true, committedFiles: state.committedFiles || [],
      message: 'This save needs review before retry. Some file writes may already have finished.', data: []
    };
  }
  if (state.phase === 'ready') return runBatchQueue(auth, payload, requests, cache, cacheKey, state);

  let idleFor = Date.now() - Number(state.lastUpdatedAt || 0);
  if (idleFor < FT_STALE_HEARTBEAT_MS) {
    let waited = 0;
    while (waited < FT_POLL_CEILING_MS) {
      Utilities.sleep(FT_POLL_INTERVAL_MS);
      waited += FT_POLL_INTERVAL_MS;
      let fresh = cache ? readFormTicketState(cache, cacheKey, requests.length) : null;
      if (!fresh) break;
      if (fresh.finished) {
        return buildFormTicketReplayResult(auth, payload, requests, fresh);
      }
    }
    return {
      success: false,
      inProgress: true,
      message: 'Your form is still being saved. Please wait a moment.',
      data: []
    };
  }

  state.queue = state.processing.concat(state.queue);
  state.processing = [];
  return runBatchQueue(auth, payload, requests, cache, cacheKey, state);
}

function createFormTicketState(requests) {
  var now = Date.now();
  var queue = [];
  for (var i = 0; i < requests.length; i++) queue.push(i);
  return {
    initiated: now,
    lastUpdatedAt: now,
    finished: false,
    resources: collectBatchResourceNames(requests),
    queue: queue,
    processing: [],
    completed: [],
    refs: scanBatchReferencePaths(requests)
  };
}

// The queue holds step indexes, not step bodies. A retry always resends the same
// requests array under the same ticket, so keeping the bodies would only push the
// cached state past its size budget for nothing.
function readFormTicketState(cache, cacheKey, requestCount) {
  try {
    let raw = cache.get(cacheKey);
    if (!raw) return null;
    let parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.queue) || !Array.isArray(parsed.completed)) return null;
    parsed.processing = Array.isArray(parsed.processing) ? parsed.processing : [];
    parsed.resources = Array.isArray(parsed.resources) ? parsed.resources : [];
    parsed.refs = parsed.refs && typeof parsed.refs === 'object' ? parsed.refs : {};
    parsed.finished = parsed.finished === true;
    let pending = parsed.queue.concat(parsed.processing);
    for (let i = 0; i < pending.length; i++) {
      let index = Number(pending[i]);
      if (!(index >= 0 && index < requestCount)) parsed.phase = 'review';
    }
    return parsed;
  } catch (readErr) {
    return null;
  }
}

function writeFormTicketState(cache, cacheKey, state) {
  if (!cache || !cacheKey || !state) return;
  try {
    cache.put(cacheKey, JSON.stringify(state), FT_CACHE_TTL_SECONDS);
  } catch (putErr) { /* a cache miss next time is safer than failing the write */ }
}

function stampFormTicketState(cache, cacheKey, state) {
  state.lastUpdatedAt = Date.now();
  writeFormTicketState(cache, cacheKey, state);
}

function collectBatchResourceNames(requests) {
  var names = [];
  var seen = {};
  var push = function (value) {
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    var name = (value === null || value === undefined ? '' : value).toString().trim();
    if (!name) return;
    var key = name.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    names.push(name);
  };

  (requests || []).forEach(function (req) {
    if (!req || typeof req !== 'object') return;
    push(req.resource);
    push(req.resources);
    push(req.targetResource);
  });

  return names;
}

function scanBatchReferencePaths(value, collected) {
  var refs = collected || {};

  if (Array.isArray(value)) {
    value.forEach(function (item) { scanBatchReferencePaths(item, refs); });
    return refs;
  }
  if (!value || typeof value !== 'object') return refs;

  if (value.$ref !== undefined) {
    var path = (value.$ref === null ? '' : value.$ref).toString().trim();
    if (path && refs[path] === undefined) refs[path] = null;
  }

  Object.keys(value).forEach(function (key) {
    scanBatchReferencePaths(value[key], refs);
  });

  return refs;
}

// Codes recovered from cache are replayed into the batch context, so a taken-over
// run resolves $ref through the same path walker as a first run.
function seedBatchContextFromRefs(batchContext, refs) {
  Object.keys(refs || {}).forEach(function (path) {
    var code = refs[path];
    if (code === null || code === undefined || code === '') return;
    var parts = path.split('.').map(function (part) { return part.trim(); }).filter(Boolean);
    if (parts.length < 2) return;
    var cursor = ensureBatchContextResource(batchContext, parts[0]);
    for (var i = 1; i < parts.length - 1; i++) {
      if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {};
      cursor = cursor[parts[i]];
    }
    cursor[parts[parts.length - 1]] = code;
  });
}

function refreshResolvedRefs(refs, batchContext) {
  Object.keys(refs || {}).forEach(function (path) {
    if (refs[path]) return;
    try {
      var resolved = resolveBatchReferencePath(batchContext, path);
      if (typeof resolved === 'string' && resolved) refs[path] = resolved;
    } catch (refErr) { /* not produced yet — a later step fills it in */ }
  });
}

function extractStepCode(res) {
  var data = res && res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : {};
  var parentCode = (data.parentCode === null || data.parentCode === undefined ? '' : data.parentCode).toString().trim();
  if (parentCode) return { key: 'parentCode', code: parentCode };
  var code = (data.code === null || data.code === undefined ? '' : data.code).toString().trim();
  if (code) return { key: 'code', code: code };
  return null;
}

function buildCompletedStepResult(entry) {
  var data = {};
  if (entry && entry.code) data[entry.codeKey || 'code'] = entry.code;
  return {
    success: !!(entry && entry.success !== false),
    message: entry && entry.message ? entry.message : '',
    data: data
  };
}

function buildFormTicketStepResults(requests, state, liveResults) {
  var byIndex = {};
  (state.completed || []).forEach(function (entry) {
    if (entry && entry.index !== undefined) byIndex[entry.index] = entry;
  });

  var live = liveResults || {};
  var results = [];
  for (var i = 0; i < requests.length; i++) {
    results.push(live[i] ? live[i] : buildCompletedStepResult(byIndex[i]));
  }
  return results;
}

// Nothing here writes to the sheet. The rows come back as a plain read delta,
// exactly the way a fresh run would have returned them.
function buildFormTicketReplayResult(auth, payload, requests, state) {
  return {
    success: true,
    replayed: true,
    message: 'Batch actions completed successfully',
    data: buildFormTicketStepResults(requests, state, null),
    deltaResources: collectWriteDeltaResources(auth, payload, state.resources || [])
  };
}

function runBatchQueue(auth, payload, requests, cache, cacheKey, state) {
  if (_activeBatchWritePlan) return { success: false, message: 'Nested batches are not supported.', data: [] };
  const allowed = ['get', 'create', 'update', 'bulk', 'compositeSave', 'executeAction', 'record'];
  const unsupported = requests.find(function(request) { return !request || allowed.indexOf(request.action) === -1; });
  if (unsupported || requests.some(function(request) { return !request; })) {
    return { success: false, message: 'Batch supports resource reads and writes only.', data: [] };
  }
  const tracked = !!state;
  state = state || createFormTicketState(requests);
  const pending = state.queue.slice();
  const plan = createBatchWritePlan();
  const cursorSnapshot = Object.assign({}, _resource_cursor_cache);
  const pendingCursorSnapshot = Object.assign({}, _pending_cursor_writes);
  const batchContext = createBatchContext();
  seedBatchContextFromRefs(batchContext, state.refs);
  const liveResults = {};
  const prepared = [];
  let failure = null;
  state.phase = 'preparing';
  state.queue = [];
  state.processing = pending.slice();
  if (tracked) stampFormTicketState(cache, cacheKey, state);
  _activeBatchWritePlan = plan;

  try {
    for (const index of pending) {
      let resolvedReq;
      let stepResult;
      try {
        resolvedReq = resolveBatchReferencesDeep(requests[index], batchContext);
        stepResult = dispatchProtectedAction(resolvedReq.action, auth, resolvedReq);
        if (plan.failure) throw plan.failure;
      } catch (error) {
        stepResult = { success: false, message: error.message || String(error) };
      }
      if (!stepResult || stepResult.success !== true) {
        failure = { index, result: stepResult || { success: false, message: 'Batch action failed.' } };
        break;
      }
      updateBatchContextFromResult(batchContext, resolvedReq, stepResult);
      const code = extractStepCode(stepResult);
      prepared.push({
        index, action: resolvedReq.action, resource: resolvedReq.resource || '',
        code: code ? code.code : '', codeKey: code ? code.key : '', message: stepResult.message || '', success: true
      });
      liveResults[index] = stepResult;
      if (tracked) stampFormTicketState(cache, cacheKey, state);
    }
    if (!failure) {
      state.phase = 'committing';
      if (tracked) stampFormTicketState(cache, cacheKey, state);
      commitBatchWritePlan(plan);
      state.completed = state.completed.concat(prepared);
      refreshResolvedRefs(state.refs, batchContext);
      state.processing = [];
      state.finished = true;
      state.phase = 'committed';
      state.committedFiles = plan.committedFiles.slice();
      if (tracked) stampFormTicketState(cache, cacheKey, state);
      return {
        success: true, message: 'Batch actions completed successfully',
        data: buildFormTicketStepResults(requests, state, liveResults)
      };
    }
  } catch (error) {
    failure = { index: -1, result: { success: false, message: error.message || String(error) } };
  } finally {
    _activeBatchWritePlan = null;
    const stagedCursorWrites = _pending_cursor_writes;
    _pending_cursor_writes = pendingCursorSnapshot;
    if (plan.state === 'committed') {
      Object.assign(_pending_cursor_writes, stagedCursorWrites);
      Object.keys(plan.cursors).forEach(function(name) {
        _pending_cursor_writes[buildResourceCursorCacheKey(name)] = String(plan.cursors[name]);
      });
    } else {
      _resource_cursor_cache = cursorSnapshot;
    }
    _resource_registry_context_cache = null;
    if (plan.state === 'open') discardBatchWritePlan(plan);
  }

  const retryUnsafe = plan.state === 'failed' || plan.state === 'committing' || plan.state === 'committed';
  state.processing = [];
  state.queue = pending;
  state.phase = retryUnsafe ? 'review' : 'ready';
  state.committedFiles = plan.committedFiles.slice();
  if (tracked) stampFormTicketState(cache, cacheKey, state);
  const results = requests.map(function(_, index) {
    if (failure && (failure.index === index || (failure.index === -1 && index === 0))) return failure.result;
    return {
      success: false, rolledBack: !retryUnsafe,
      message: failure ? failure.result.message : 'Batch not saved.',
      errors: failure && Array.isArray(failure.result.errors) ? failure.result.errors : []
    };
  });
  return {
    success: false, retryUnsafe, committedFiles: plan.committedFiles.slice(), unconfirmedFile: plan.unconfirmedFile || '',
    message: failure ? failure.result.message : 'Batch not saved.', data: results
  };
}

function openScriptCache() {
  try {
    return CacheService.getScriptCache();
  } catch (cacheErr) {
    return null;
  }
}

function createBatchContext() {
  return { resources: {} };
}

function resolveBatchReferencesDeep(value, batchContext) {
  if (Array.isArray(value)) {
    return value.map(function (item) { return resolveBatchReferencesDeep(item, batchContext); });
  }
  if (value && typeof value === 'object') {
    var keys = Object.keys(value);
    if (keys.length === 1 && value.$ref !== undefined) {
      return resolveBatchReferencePath(batchContext, value.$ref);
    }
    // A $ref JOINED to literal codes already known to the caller — e.g. an invoice
    // bundling the consumption this batch is about to create together with several
    // earlier ones, whose column holds a comma-separated list.
    //
    // The join happens HERE, on resolution, rather than in the frontend: the transport
    // contract forbids stringifying or concatenating a $ref payload object
    // (CORE_ARCHITECTURE_RULES §3), because a client-side concatenation would have to
    // guess the code before the batch has created the record. The literals are plain
    // strings; only the unresolved half is a reference.
    if (value.$ref !== undefined && Array.isArray(value.$append)) {
      var head = resolveBatchReferencePath(batchContext, value.$ref);
      var separator = value.$separator === undefined ? ',' : String(value.$separator);
      var parts = [head].concat(value.$append)
        .map(function (part) { return (part === null || part === undefined ? '' : String(part).trim()); })
        .filter(function (part) { return part !== ''; });
      // De-duplicated: a caller that also listed the new record's own code would
      // otherwise write it twice, and membership tests downstream read the list as a set.
      var seen = {};
      return parts.filter(function (part) {
        if (seen[part]) return false;
        seen[part] = true;
        return true;
      }).join(separator);
    }
    var cloned = {};
    keys.forEach(function (key) {
      cloned[key] = resolveBatchReferencesDeep(value[key], batchContext);
    });
    return cloned;
  }
  return value;
}

function resolveBatchReferencePath(batchContext, refPath) {
  var path = (refPath || '').toString().trim();
  if (!path) {
    throw new Error('Batch $ref path is required');
  }

  var parts = path.split('.');
  var resourceName = parts.shift();
  var current = batchContext.resources[resourceName];
  if (current === undefined) {
    throw new Error('Unable to resolve batch $ref "' + path + '": resource not found in batch context');
  }

  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (current === null || current === undefined || current[part] === undefined) {
      throw new Error('Unable to resolve batch $ref "' + path + '" at "' + part + '"');
    }
    current = current[part];
  }
  return current;
}

function updateBatchContextFromResult(batchContext, request, rawResult) {
  updateBatchContextFromRawResources(batchContext, rawResult);

  var actionResourceName = request && request.resource
    ? (Array.isArray(request.resource) ? request.resource[0] : request.resource)
    : '';
  var actionScalarCode = rawResult && rawResult.data && typeof rawResult.data === 'object' && !Array.isArray(rawResult.data)
    ? (rawResult.data.parentCode || rawResult.data.code || '').toString().trim()
    : '';
  if (actionResourceName && actionScalarCode) {
    ensureBatchContextResource(batchContext, actionResourceName).latest.code = actionScalarCode;
  }

  var normalizedReq = {
    requestId: request && request.requestId ? request.requestId : Utilities.getUuid(),
    action: request && request.action ? request.action : '',
    resource: request && request.resource ? request.resource : '',
    payload: request || {}
  };
  var envelope = buildApiEnvelope(normalizedReq, rawResult || {});
  var resourcePayloads = envelope && envelope.data && envelope.data.resources ? envelope.data.resources : {};
  Object.keys(resourcePayloads).forEach(function (resourceName) {
    updateBatchContextResourceFromPayload(batchContext, resourceName, resourcePayloads[resourceName]);
  });

  var result = envelope && envelope.data && envelope.data.result ? envelope.data.result : {};
  if (request && request.resource) {
    var scalarCode = (result.parentCode || result.code || '').toString().trim();
    if (scalarCode) {
      var resourceName = Array.isArray(request.resource) ? request.resource[0] : request.resource;
      ensureBatchContextResource(batchContext, resourceName).latest.code = scalarCode;
    }
  }
}

function updateBatchContextFromRawResources(batchContext, rawResult) {
  var data = rawResult && rawResult.data && typeof rawResult.data === 'object' && !Array.isArray(rawResult.data)
    ? rawResult.data
    : {};
  var resources = data.resources && typeof data.resources === 'object' && !Array.isArray(data.resources)
    ? data.resources
    : {};
  Object.keys(resources).forEach(function (resourceName) {
    updateBatchContextResourceFromPayload(batchContext, resourceName, resources[resourceName]);
  });

  Object.keys(data).forEach(function (key) {
    if (key === 'resources') return;
    var value = data[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.rows)) {
      updateBatchContextResourceFromPayload(batchContext, key, value);
    }
  });
}

function updateBatchContextResourceFromPayload(batchContext, resourceName, payload) {
  var entry = ensureBatchContextResource(batchContext, resourceName);
  var rows = payload && Array.isArray(payload.rows) ? payload.rows : [];
  var headers = payload && Array.isArray(payload.headers) ? payload.headers : [];
  var records = headers.length ? rows.map(function (row) { return rowArrayToObject(headers, row); }) : [];
  entry.records = records;
  records.forEach(function (record) {
    var code = (record.Code || '').toString().trim();
    if (code) {
      entry.byCode[code] = record;
    }
  });
  if (records.length) {
    var latestRecord = records[records.length - 1];
    entry.latest = {
      record: latestRecord,
      code: (latestRecord.Code || entry.latest.code || '').toString().trim()
    };
  }
}

function ensureBatchContextResource(batchContext, resourceName) {
  var name = (resourceName || '').toString().trim();
  if (!batchContext.resources[name]) {
    batchContext.resources[name] = { latest: {}, records: [], byCode: {} };
  }
  return batchContext.resources[name];
}


function hasResourceSelector(payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  if (Array.isArray(payload.resource)) {
    if (payload.resource.some(function (item) { return (item || '').toString().trim(); })) {
      return true;
    }
  } else if ((payload.resource || '').toString().trim()) {
    return true;
  }

  if (Array.isArray(payload.resources)) {
    return payload.resources.some(function (item) { return (item || '').toString().trim(); });
  }

  if (typeof payload.resources === 'string') {
    return payload.resources.split(',').map(function (item) { return item.trim(); }).filter(Boolean).length > 0;
  }

  return false;
}

function isGenericCrudAction(action, payload) {
  const normalizedAction = (action || '').toString().trim().toLowerCase();

  if (!isCanonicalCrudVerb(normalizedAction)) {
    return false;
  }

  return hasResourceSelector(payload);
}

function dispatchResourceCrudAction(action, auth, payload) {
  const normalizedAction = (action || '').toString().trim().toLowerCase();

  // Config only: this check reads one field and must not open the spreadsheet.
  const resourceName = resolveResourceName(payload);
  const resourceConfig = getResourceConfig(resourceName);
  if (resourceConfig.scope === 'view' && normalizedAction !== 'get') {
    return { success: false, error: 'View-scope resources are read-only.' };
  }

  if (normalizedAction === 'get') {
    const hasMultiResourceRequest = payload && (
      (Array.isArray(payload.resources) && payload.resources.length > 0) ||
      (payload.resources !== undefined && payload.resources !== null && payload.resources !== '') ||
      (Array.isArray(payload.resource) && payload.resource.length > 1)
    );
    if (hasMultiResourceRequest) {
      return handleResourceGetMultiRecords(auth, payload);
    }
    return handleResourceGetRecords(auth, payload);
  }

  if (normalizedAction === 'create') {
    // Array payload → bulk create/upsert via PostAction (or generic bulk fallback).
    // action=bulk is reserved exclusively for the Bulk Upload UI (BulkUploadMasters).
    if (Array.isArray(payload.records) && payload.records.length > 0) {
      return dispatchBulkCreateRecords(auth, payload);
    }
    return handleResourceCreateRecord(auth, payload);
  }

  if (normalizedAction === 'update') {
    // Array payload → bulk update via PostAction (or generic bulk fallback).
    if (Array.isArray(payload.records) && payload.records.length > 0) {
      return dispatchBulkCreateRecords(auth, payload);
    }
    return handleResourceUpdateRecord(auth, payload);
  }

  if (normalizedAction === 'bulk') {
    return handleResourceBulkUpsertRecords(auth, payload);
  }

  return { success: false, message: 'Unsupported resource action' };
}

function handlePollAction(auth, payload) {
  const cursors = payload && payload.cursors ? payload.cursors : {};
  const updatedResources = [];

  // Stamp the cursor BEFORE reading any resource state. If the stamp were taken
  // after evaluation, a write landing mid-evaluation would carry a
  // LastDataUpdatedAt earlier than the returned serverTime; the client would
  // then advance its unchanged-resource cursor past that write and never see it.
  const serverTime = Date.now();

  // Live cursors come from the dedicated cursor store (CacheService keyed by
  // spreadsheet id + resource), NOT from the frozen resource config snapshot.
  // The config snapshot is cached permanently and its lastDataUpdatedAt goes
  // stale the moment any write lands, which is what made every poll report
  // zero updates.
  const resourceNames = Object.keys(cursors);
  const serverCursors = getResourceSyncCursors(resourceNames) || {};

  // Resolve readable resources ONCE for the whole heartbeat. Calling
  // enforceMasterPermission per resource rebuilt the permission catalog on every
  // iteration, and the surrounding try/catch cost a console.warn RPC for each
  // resource the user cannot read — on a poll that fires every 30s.
  const roleIds = auth && Array.isArray(auth.roleIds) ? auth.roleIds : [];
  const readable = getReadableResourceNameSet(roleIds);

  resourceNames.forEach(function (resourceName) {
    // Mirror enforceMasterPermission exactly: catalog membership first, then
    // the hasRolePermission fallback for resources the catalog omits (inactive,
    // or IncludeInAuthorizationPayload=FALSE). Skipping straight to the set
    // alone would silently stop reporting updates for those resources.
    if (!readable[resourceName] && !hasRolePermission(roleIds, resourceName, 'canRead')) return;

    const clientCursor = Number(cursors[resourceName]) || 0;
    const serverLastUpdated = Number(serverCursors[resourceName]) || 0;
    if (serverLastUpdated > clientCursor) {
      updatedResources.push(resourceName);
    }
  });

  // Strictly a cursor check — never a row payload.
  return {
    success: true,
    data: {
      updatedResources: updatedResources,
      serverTime: serverTime
    }
  };
}

function createBatchWritePlan() {
  return { files: new Map(), sheets: new Map(), state: 'open', committedFiles: [], cursors: {}, cursorFileId: '' };
}

function getBatchSheetView(plan, sheet) {
  if (!plan || plan.state !== 'open') throw new Error('Batch write plan is not open.');
  const file = sheet.getParent();
  const fileId = file.getId();
  const sheetId = sheet.getSheetId();
  const key = fileId + ':' + sheetId;
  if (plan.sheets.has(key)) return plan.sheets.get(key).view;
  const values = sheet.getDataRange().getValues().map(function(row) { return row.slice(); });
  const entry = {
    sheet, file, fileId, sheetId, values, writes: [],
    maxRows: sheet.getMaxRows(), maxColumns: sheet.getMaxColumns()
  };
  function range(row, column, height, width) {
    height = height === undefined ? 1 : height;
    width = width === undefined ? 1 : width;
    if (![row, column, height, width].every(function(value) { return Number.isInteger(value) && value > 0; })) {
      throw new Error('Batch ranges need positive row and column numbers.');
    }
    function read() {
      return Array.from({ length: height }, function(_, y) {
        return Array.from({ length: width }, function(_, x) {
          const value = values[row - 1 + y] && values[row - 1 + y][column - 1 + x];
          return value === undefined ? '' : value;
        });
      });
    }
    function write(input) {
      if (plan.state !== 'open') throw new Error('Batch write plan is not open.');
      if (!Array.isArray(input) || input.length !== height ||
          input.some(function(line) { return !Array.isArray(line) || line.length !== width; })) {
        throw new Error('Batch values do not match the range size.');
      }
      const copied = input.map(function(line) { return line.slice(); });
      copied.forEach(function(line, y) {
        if (!values[row - 1 + y]) values[row - 1 + y] = [];
        line.forEach(function(value, x) { values[row - 1 + y][column - 1 + x] = value; });
      });
      entry.writes.push({ row, column, values: copied });
      return result;
    }
    const result = {
      getValues: read,
      getValue: function() { return read()[0][0]; },
      setValues: write,
      setValue: function(value) {
        if (height !== 1 || width !== 1) throw new Error('Batch setValue needs a single cell.');
        return write([[value]]);
      },
      getRow: function() { return row; },
      getColumn: function() { return column; },
      getNumRows: function() { return height; },
      getNumColumns: function() { return width; },
      getSheet: function() { return entry.view; },
      createTextFinder: function(text) {
        let whole = false;
        let sensitive = false;
        const finder = {
          matchEntireCell: function(value) { whole = value; return finder; },
          matchCase: function(value) { sensitive = value; return finder; },
          findNext: function() {
            const target = sensitive ? String(text) : String(text).toLowerCase();
            const cells = read();
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const value = sensitive ? String(cells[y][x]) : String(cells[y][x]).toLowerCase();
                if (whole ? value === target : value.indexOf(target) !== -1) return range(row + y, column + x);
              }
            }
            return null;
          }
        };
        return finder;
      }
    };
    return result;
  }
  entry.view = {
    getParent: function() { return file; },
    getName: function() { return sheet.getName(); },
    getSheetId: function() { return sheetId; },
    getMaxRows: function() { return entry.maxRows; },
    getMaxColumns: function() { return entry.maxColumns; },
    getLastRow: function() {
      for (let index = values.length - 1; index >= 0; index--) {
        if ((values[index] || []).some(function(value) { return value !== '' && value != null; })) return index + 1;
      }
      return 0;
    },
    getLastColumn: function() {
      return values.reduce(function(last, line) {
        for (let index = line.length - 1; index >= last; index--) {
          if (line[index] !== '' && line[index] != null) return index + 1;
        }
        return last;
      }, 0);
    },
    getRange: range,
    getDataRange: function() {
      return range(1, 1, Math.max(1, entry.view.getLastRow()), Math.max(1, entry.view.getLastColumn()));
    }
  };
  if (!plan.files.has(fileId)) plan.files.set(fileId, []);
  plan.files.get(fileId).push(entry);
  plan.sheets.set(key, entry);
  return entry.view;
}

function batchCellValue(value, timeZone) {
  if (value === '' || value == null) return {};
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('Batch contains an invalid date.');
    const local = Utilities.formatDate(value, timeZone, "yyyy-MM-dd'T'HH:mm:ss.SSS");
    return { numberValue: Date.parse(local + 'Z') / 86400000 + 25569 };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Batch contains an invalid number.');
    return { numberValue: value };
  }
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value !== 'string') throw new Error('Batch cells must contain plain sheet values.');
  return value.charAt(0) === '=' ? { formulaValue: value } : { stringValue: value };
}

function batchFileRequests(entries) {
  const requests = [];
  entries.forEach(function(entry) {
    if (!entry.writes.length) return;
    const lastRow = entry.writes.reduce(function(last, write) {
      return Math.max(last, write.row - 1 + write.values.length);
    }, 0);
    const lastColumn = entry.writes.reduce(function(last, write) {
      return Math.max(last, write.column - 1 + write.values[0].length);
    }, 0);
    if (lastRow > entry.maxRows) {
      requests.push({ appendDimension: { sheetId: entry.sheetId, dimension: 'ROWS', length: lastRow - entry.maxRows } });
    }
    if (lastColumn > entry.maxColumns) {
      requests.push({ appendDimension: { sheetId: entry.sheetId, dimension: 'COLUMNS', length: lastColumn - entry.maxColumns } });
    }
    const timeZone = entry.file.getSpreadsheetTimeZone();
    entry.writes.forEach(function(write) {
      requests.push({
        updateCells: {
          start: { sheetId: entry.sheetId, rowIndex: write.row - 1, columnIndex: write.column - 1 },
          rows: write.values.map(function(line) {
            return { values: line.map(function(value) { return { userEnteredValue: batchCellValue(value, timeZone) }; }) };
          }),
          fields: 'userEnteredValue'
        }
      });
    });
  });
  return requests;
}

function commitBatchWritePlan(plan) {
  if (!plan || plan.state === 'discarded') throw new Error('Batch write plan was discarded.');
  if (plan.state === 'committed') return { success: true, committedFiles: plan.committedFiles.slice() };
  if (plan.state !== 'open') throw new Error('Batch write outcome needs review before retry.');
  const files = Array.from(plan.files, function(pair) {
    return { fileId: pair[0], requests: batchFileRequests(pair[1]) };
  }).filter(function(file) { return file.requests.length > 0; }).sort(function(a, b) {
    return Number(a.fileId === plan.cursorFileId) - Number(b.fileId === plan.cursorFileId);
  });
  const bodies = files.map(function(file) { return JSON.stringify({ requests: file.requests }); });
  plan.state = 'committing';
  try {
    files.forEach(function(file, index) {
      plan.unconfirmedFile = file.fileId;
      const response = UrlFetchApp.fetch(
        'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(file.fileId) + ':batchUpdate', {
          method: 'post', contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
          payload: bodies[index], muteHttpExceptions: true
        });
      const status = response.getResponseCode();
      if (status < 200 || status >= 300) {
        let message = 'Sheets batch write failed (HTTP ' + status + ').';
        try {
          const body = JSON.parse(response.getContentText());
          if (body.error && body.error.message) message = body.error.message;
        } catch (error) {}
        throw new Error(message);
      }
      plan.committedFiles.push(file.fileId);
      plan.unconfirmedFile = '';
    });
    plan.state = 'committed';
    return { success: true, committedFiles: plan.committedFiles.slice() };
  } catch (error) {
    plan.state = 'failed';
    error.committedFiles = plan.committedFiles.slice();
    error.unconfirmedFile = plan.unconfirmedFile;
    throw error;
  }
}

function discardBatchWritePlan(plan) {
  if (!plan || plan.state !== 'open') throw new Error('Only an uncommitted batch plan can be discarded.');
  plan.files.clear();
  plan.sheets.clear();
  plan.state = 'discarded';
}
