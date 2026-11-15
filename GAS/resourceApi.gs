// Memoized per execution: an initial sync spans only 3-4 files.
var _file_last_updated_cache = {};
const _code_sequence_cache = new WeakMap();

function getSpreadsheetLastUpdatedMillis(fileId) {
  var id = (fileId || '').toString().trim();
  if (!id) return 0;
  if (_file_last_updated_cache[id] !== undefined) return _file_last_updated_cache[id];

  var millis = 0;
  try {
    var updated = DriveApp.getFileById(id).getLastUpdated();
    millis = updated ? updated.getTime() : 0;
  } catch (e) {
    millis = 0;
  }

  _file_last_updated_cache[id] = millis;
  return millis;
}

function resolveUnchangedResourceResponse(auth, resourceName, config, lastUpdatedAt) {
  if (!lastUpdatedAt) return null;
  if (config.scope === 'view') return null;

  var clientCursor = lastUpdatedAt.getTime();

  var storedCursor = 0;
  try {
    storedCursor = getResourceSyncCursor(resourceName) || 0;
  } catch (e) {
    return null;
  }
  if (!storedCursor) return null;
  if (storedCursor > clientCursor) return null;

  var fileUpdated = getSpreadsheetLastUpdatedMillis(config.fileId);
  if (!fileUpdated) return null;
  if (fileUpdated > clientCursor) return null;

  return {
    success: true,
    rows: [],
    meta: {
      resource: resourceName,
      fileId: config.fileId,
      sheetName: config.sheetName,
      requestedBy: auth && auth.user ? auth.user.UserID : null,
      hasDeltaFilter: true,
      lastDataUpdatedAt: storedCursor,
      lastSyncAt: Date.now()
    }
  };
}

function handleResourceGetRecords(auth, payload) {
  const resourceName = resolveResourceName(payload);
  // Config first: the permission check and short-circuit need no spreadsheet.
  const config = getResourceConfig(resourceName);
  enforceMasterPermission(auth, resourceName, 'canRead');

  const lastUpdatedAt = payload && payload.lastUpdatedAt ? parseDateInput(payload.lastUpdatedAt) : null;

  const unchanged = resolveUnchangedResourceResponse(auth, resourceName, config, lastUpdatedAt);
  if (unchanged) return unchanged;

  const resource = openResourceSheet(resourceName);
  // Not getSheetHeaders: that derives the file id via a getParent() round-trip
  // per resource, ~40 of them on an initial sync. Same cache key.
  const headers = getSheetHeadersByMeta(config.fileId, config.sheetName, resource.sheet);

  if (!headers.length) {
    return buildResourceRowsResponse(auth, resourceName, resource, [], lastUpdatedAt, []);
  }

  const values = resource.sheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    return buildResourceRowsResponse(auth, resourceName, resource, [], lastUpdatedAt, headers);
  }

  // For view scope, return all non-empty rows (no pagination, no delta filtering)
  if (resource.config.scope === 'view') {
    const allRows = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      // Filter out rows where all cells are blank (formula rows with no source data)
      const hasData = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
      if (hasData) allRows.push(row);
    }
    return buildResourceRowsResponse(auth, resourceName, resource, allRows, null, headers);
  }

  const idx = getHeaderIndexMap(headers);
  const updatedAtIdx = idx.UpdatedAt;
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    if (lastUpdatedAt && updatedAtIdx !== undefined) {
      const updatedDate = parseDateInput(row[updatedAtIdx]);
      if (!updatedDate || updatedDate.getTime() <= lastUpdatedAt.getTime()) {
        continue;
      }
    }

    rows.push(row);
  }

  return buildResourceRowsResponse(auth, resourceName, resource, rows, lastUpdatedAt, headers);
}

function handleResourceGetMultiRecords(auth, payload) {
  const requestedResources = resolveResourceNames(payload);
  if (!requestedResources.length) {
    throw new Error('Master resources are required');
  }

  try {
    getResourceSyncCursors(requestedResources);
  } catch (e) { /* best-effort warm; per-resource lookup still works */ }

  const data = {};
  requestedResources.forEach(function (resourceName) {
    const singlePayload = cloneWithResource(payload, resourceName);
    const cursor = resolveMultiResourceCursor(payload, resourceName);
    if (cursor !== null && cursor !== undefined && cursor !== '') {
      singlePayload.lastUpdatedAt = cursor;
    } else {
      delete singlePayload.lastUpdatedAt;
    }
    data[resourceName] = handleResourceGetRecords(auth, singlePayload);
  });

  return {
    success: true,
    data: data,
    meta: {
      resources: requestedResources,
      lastSyncAt: Date.now()
    }
  };
}

function handleResourceRecordFetch(auth, payload) {
  let resourceRequests = payload && Array.isArray(payload.resources) ? payload.resources : null;
  if (!resourceRequests || !resourceRequests.length) {
    return { success: false, message: 'record requires payload.resources[]' };
  }

  let allowMissing = payload && payload.allowMissing === true;
  let resourcePayloads = {};
  let recordsByResource = {};
  let byCodeByResource = {};
  let codesByResource = {};
  let missingByResource = {};
  let errors = [];
  let fatalErrors = [];

  for (let r = 0; r < resourceRequests.length; r++) {
    let entry = resourceRequests[r] || {};
    let requestedResourceName = (entry.resource || '').toString().trim();
    if (!requestedResourceName) {
      fatalErrors.push({ index: r, message: 'resource is required' });
      continue;
    }
    if (!Array.isArray(entry.codes)) {
      fatalErrors.push({ resource: requestedResourceName, message: 'codes must be an array' });
      continue;
    }

    let resourceName;
    try {
      resourceName = resolveResourceName({ resource: requestedResourceName });
      enforceMasterPermission(auth, resourceName, 'canRead');
    } catch (err) {
      fatalErrors.push({ resource: requestedResourceName, message: err && err.message ? err.message : String(err) });
      continue;
    }

    let codes = entry.codes.map(function (code) { return (code || '').toString().trim(); }).filter(Boolean);
    codesByResource[resourceName] = codes;
    recordsByResource[resourceName] = [];
    byCodeByResource[resourceName] = {};
    missingByResource[resourceName] = [];

    let resource = openResourceSheet(resourceName);
    let sheet = resource.sheet;
    let headers = getSheetHeadersByMeta(resource.config.fileId, resource.config.sheetName, sheet);
    let idx = getHeaderIndexMap(headers);
    let foundRows = [];

    if (idx.Code === undefined) {
      fatalErrors.push({ resource: resourceName, message: 'Code column is required' });
      continue;
    }

    if (!codes.length) {
      resourcePayloads[resourceName] = buildDirectWriteResourcePayload(resourceName, resource.config, headers, []);
      continue;
    }

    let rowByCode = {};
    let lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      let codeColWidth = idx.Code + 1;
      let useNarrowLookup = codeColWidth < headers.length && codes.length < Math.max(2, Math.ceil((lastRow - 1) / 4));
      if (useNarrowLookup) {
        let codeValues = sheet.getRange(1, 1, lastRow, codeColWidth).getValues();
        const rowNumByCode = new Map();
        for (let i = 1; i < codeValues.length; i++) {
          const code = (codeValues[i][idx.Code] || '').toString().trim();
          if (code && !rowNumByCode.has(code)) rowNumByCode.set(code, i + 1);
        }
        const matchedRowNums = codes.map(function(code) { return rowNumByCode.get(code); }).filter(Boolean);
        if (_activeBatchWritePlan && matchedRowNums.length) {
          getBatchSheetView(_activeBatchWritePlan, sheet, null, { rows: matchedRowNums, width: headers.length });
        }
        codes.forEach(function (code) {
          const rNum = rowNumByCode.get(code);
          if (rNum && rNum !== -1 && !rowByCode[code]) {
            rowByCode[code] = sheet.getRange(rNum, 1, 1, headers.length).getValues()[0];
          }
        });
      } else {
        let values = sheet.getRange(1, 1, lastRow, headers.length).getValues();
        for (let i = 1; i < values.length; i++) {
          let row = values[i];
          let rowCode = (row[idx.Code] || '').toString().trim();
          if (rowCode && rowByCode[rowCode] === undefined) {
            rowByCode[rowCode] = row;
          }
        }
      }
    }

    codes.forEach(function (code) {
      let matchedRow = rowByCode[code];
      if (!matchedRow) {
        missingByResource[resourceName].push(code);
        return;
      }
      try {
        enforceRecordLevelAccess(auth, resource.config, headers, matchedRow);
        let record = rowArrayToObject(headers, matchedRow);
        foundRows.push(matchedRow);
        recordsByResource[resourceName].push(record);
        byCodeByResource[resourceName][code] = record;
      } catch (accessErr) {
        missingByResource[resourceName].push(code);
        if (!allowMissing) {
          errors.push({ resource: resourceName, code: code, message: accessErr && accessErr.message ? accessErr.message : String(accessErr) });
        }
      }
    });

    resourcePayloads[resourceName] = buildDirectWriteResourcePayload(resourceName, resource.config, headers, foundRows);
  }

  Object.keys(missingByResource).forEach(function (resourceName) {
    let missing = missingByResource[resourceName] || [];
    if (!allowMissing && missing.length) {
      missing.forEach(function (code) {
        errors.push({ resource: resourceName, code: code, message: 'Record not found or inaccessible' });
      });
    }
  });

  let responseErrors = fatalErrors.concat(errors);
  if (fatalErrors.length || (errors.length && !allowMissing)) {
    return {
      success: false,
      message: 'record fetch failed',
      errors: responseErrors,
      data: {
        resources: resourcePayloads,
        codes: codesByResource,
        records: recordsByResource,
        byCode: byCodeByResource,
        missing: missingByResource
      }
    };
  }

  return {
    success: true,
    message: 'Records fetched successfully',
    data: {
      resources: resourcePayloads,
      codes: codesByResource,
      records: recordsByResource,
      byCode: byCodeByResource,
      missing: missingByResource
    }
  };
}

function handleResourceCreateRecord(auth, payload) {
  const resourceName = resolveResourceName(payload);
  const resource = openResourceSheet(resourceName);
  const schema = buildMasterSchemaFromResourceConfig(resource.config);

  const sheet = resource.sheet;
  const headers = getSheetHeadersByMeta(resource.config.fileId, resource.config.sheetName, sheet);
  const idx = getHeaderIndexMap(headers);
  const recordPayload = payload && typeof payload.record === 'object' && payload.record !== null
    ? payload.record
    : (payload && typeof payload.data === 'object' && payload.data !== null ? payload.data : null);
  if (!recordPayload) {
    return { success: false, message: 'Create requires payload.record or payload.data' };
  }

  const providedValues = extractProvidedHeaderValues(headers, { record: recordPayload });
  const providedCode = resolveCodeValue({ record: recordPayload });

  var maxColIdx = idx.Code !== undefined ? idx.Code : 0;
  (schema.uniqueHeaders || []).forEach(function (h) {
    if (idx[h] !== undefined && idx[h] > maxColIdx) maxColIdx = idx[h];
  });
  (schema.uniqueCompositeHeaders || []).forEach(function (combo) {
    (combo || []).forEach(function (h) {
      if (idx[h] !== undefined && idx[h] > maxColIdx) maxColIdx = idx[h];
    });
  });
  var maxNeededCol = Math.min(headers.length, maxColIdx + 1);
  if (maxNeededCol < 1) maxNeededCol = 1;

  var lastRow = sheet.getLastRow();

  var values;
  if (lastRow > 1) {
    values = sheet.getRange(1, 1, lastRow, maxNeededCol).getValues();
  } else {
    values = [headers.slice(0, maxNeededCol)];
  }

  let code = providedCode;
  if (!code) {
    const codePrefix = (resource.config.codePrefix || '').toString().trim();
    if (!codePrefix) {
      return { success: false, message: 'CodePrefix is missing for resource: ' + resourceName };
    }

    const seqLength = resource.config.codeSequenceLength || 6;
    code = resource.config.scope === 'operation'
      ? generateNextYearScopedCode(values, idx, codePrefix, seqLength)
      : generateNextCode(values, idx, codePrefix, seqLength);
  }
  const rowData = buildNewResourceRow(headers, idx, providedValues, schema);
  rowData[idx.Code] = code;

  applyAccessRegionOnWrite(rowData, idx, auth, resource.config);
  const recordTimestamp = applyAuditFields(rowData, idx, auth, resource.config, true);
  validateRequiredFields(rowData, idx, schema.requiredHeaders, resourceName);
  validateMasterUniqueness(values, idx, rowData, schema, -1, resourceName);

  const targetRow = lastRow + 1;
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowData]);
  updateResourceSyncCursor(resourceName, recordTimestamp);

  var savedRecord = rowArrayToObject(headers, rowData);
  var directPayload = buildDirectWriteResourcePayload(resourceName, resource.config, headers, [rowData], auth, recordTimestamp);
  var directResources = {};
  directResources[resourceName] = directPayload;

  var result = {
    success: true,
    message: resourceName + ' record created successfully',
    data: mergeDeltaResourcesIntoResult(
      { code: code },
      directResources
    )
  };
  var sideEffectResources = [];
  if (resourceName === 'OutletMovements') {
    sideEffectResources.push('OutletStorages');
  } else if (resourceName === 'StockMovements') {
    sideEffectResources.push('WarehouseStorages');
  }
  dispatchPostActionHook(resource.config, payload, result, auth, 'create', {
    headers: headers,
    savedRecord: savedRecord
  }, resourceName);

  if (sideEffectResources.length) {
    var deltaPayloads = collectWriteDeltaResources(auth, payload, sideEffectResources);
    result.data = mergeDeltaResourcesIntoResult(result.data, deltaPayloads);
  }
  return result;
}

function getPostActionSuffix(action) {
  switch ((action || '').toString().trim()) {
    case 'create': return 'Create';
    case 'update': return 'Update';
    case 'bulk': return 'Bulk';
    case 'executeAction': return 'ExecuteAction';
    case 'compositeSave': return 'CompositeSave';
    default: return '';
  }
}

function dispatchPostActionHook(config, payload, result, auth, action, meta, resourceName) {
  let normalizedAction = (action || '').toString().trim();
  if (!normalizedAction || normalizedAction === 'get' || normalizedAction === 'batch') return;

  let suffix = getPostActionSuffix(normalizedAction);
  if (!suffix) return;

  let postAction = config && config.postAction ? config.postAction.toString().trim() : '';
  if (!postAction) return;

  if (_activeBatchWritePlan && _activeBatchWritePlan.strict && STAGED_POST_ACTIONS.indexOf(postAction) === -1) {
    throw new Error('PostAction is not supported in a staged batch: ' + postAction);
  }
  const hookStartedAt = Date.now();
  const candidates = [postAction + '_after' + suffix, postAction];
  try {
    for (let i = 0; i < candidates.length; i++) {
      let fn = this[candidates[i]];
      if (typeof fn === 'function') {
        const outcome = fn(payload || {}, result || {}, auth || {}, normalizedAction, meta || {}, resourceName || '');
        if (_activeBatchWritePlan && _activeBatchWritePlan.strict && outcome && outcome.success === false) {
          throw new Error(outcome.message || outcome.error || 'PostAction failed: ' + postAction);
        }
        return;
      }
    }
  } catch (e) {
    if (_activeBatchWritePlan && _activeBatchWritePlan.strict) {
      _activeBatchWritePlan.failure = e;
      throw e;
    }
    Logger.log('dispatchPostActionHook error for "' + postAction + '" (' + normalizedAction + '): ' + String(e));
  } finally {
    if (_requestMetrics) _requestMetrics.hookMs = (_requestMetrics.hookMs || 0) + Date.now() - hookStartedAt;
  }
}

function dispatchBulkCreateRecords(auth, payload) {
  var resourceName = '';
  try {
    resourceName = (payload.resource || '').toString().trim();
  } catch (e) {}

  if (!resourceName) {
    return { success: false, message: 'Resource name is required' };
  }

  // Always use the generic bulk upsert for the actual row write
  var bulkPayload = {};
  var keys = Object.keys(payload || {});
  for (var i = 0; i < keys.length; i++) {
    bulkPayload[keys[i]] = payload[keys[i]];
  }
  bulkPayload.targetResource = resourceName;

  return handleResourceBulkUpsertRecords(auth, bulkPayload);
}

function handleResourceUpdateRecord(auth, payload) {
  const resourceName = resolveResourceName(payload);
  const resource = openResourceSheet(resourceName);
  const schema = buildMasterSchemaFromResourceConfig(resource.config);

  const sheet = resource.sheet;
  const headers = getSheetHeadersByMeta(resource.config.fileId, resource.config.sheetName, sheet);
  const idx = getHeaderIndexMap(headers);

  const code = sanitizeRequiredText(resolveCodeValue(payload), 'Code is required');
  const rowNumber = findRowByValue(sheet, idx.Code, code, 2, true);
  if (rowNumber === -1) {
    return { success: false, message: resourceName + ' record not found' };
  }

  const existingRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const previousRecord = rowArrayToObject(headers, existingRow);
  enforceRecordLevelAccess(auth, resource.config, headers, existingRow);
  const recordPayload = payload && typeof payload.record === 'object' && payload.record !== null
    ? payload.record
    : (payload && typeof payload.data === 'object' && payload.data !== null ? payload.data : null);
  if (!recordPayload) {
    return { success: false, message: 'Update requires payload.record or payload.data' };
  }

  const providedValues = extractProvidedHeaderValues(headers, { record: recordPayload });
  const mergedRow = mergeMasterRow(existingRow, idx, providedValues, schema);
  mergedRow[idx.Code] = code;

  const recordTimestamp = applyAuditFields(mergedRow, idx, auth, resource.config, false);
  validateRequiredFields(mergedRow, idx, schema.requiredHeaders, resourceName);

  var hasUniqueness = (schema.uniqueHeaders && schema.uniqueHeaders.length) || (schema.uniqueCompositeHeaders && schema.uniqueCompositeHeaders.length);
  if (hasUniqueness) {
    var maxColIdx = 0;
    (schema.uniqueHeaders || []).forEach(function (h) {
      if (idx[h] !== undefined && idx[h] > maxColIdx) maxColIdx = idx[h];
    });
    (schema.uniqueCompositeHeaders || []).forEach(function (combo) {
      (combo || []).forEach(function (h) {
        if (idx[h] !== undefined && idx[h] > maxColIdx) maxColIdx = idx[h];
      });
    });
    var maxNeededCol = Math.min(headers.length, maxColIdx + 1);
    if (maxNeededCol < 1) maxNeededCol = 1;

    var lastRow = sheet.getLastRow();

    if (lastRow > 1) {
      var values = sheet.getRange(1, 1, lastRow, maxNeededCol).getValues();
      validateMasterUniqueness(values, idx, mergedRow, schema, rowNumber, resourceName);
    }
  }

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([mergedRow]);
  updateResourceSyncCursor(resourceName, recordTimestamp);

  var savedRecord = rowArrayToObject(headers, mergedRow);
  var directPayload = buildDirectWriteResourcePayload(resourceName, resource.config, headers, [mergedRow], auth, recordTimestamp);
  var directResources = {};
  directResources[resourceName] = directPayload;

  var result = {
    success: true,
    message: resourceName + ' record updated successfully',
    data: mergeDeltaResourcesIntoResult(
      { code: code },
      directResources
    )
  };
  var sideEffectResources = [];
  if (resourceName === 'WarehouseTransferItems') {
    sideEffectResources.push('WarehouseTransfers', 'StockMovements', 'WarehouseStorages');
  }
  dispatchPostActionHook(resource.config, payload, result, auth, 'update', {
    headers: headers,
    previousRecord: previousRecord,
    savedRecord: savedRecord
  }, resourceName);

  if (sideEffectResources.length) {
    var deltaPayloads = collectWriteDeltaResources(auth, payload, sideEffectResources);
    result.data = mergeDeltaResourcesIntoResult(result.data, deltaPayloads);
  }
  return result;
}

function handleResourceGetProducts(auth, payload) {
  return handleResourceGetRecords(auth, attachResourceName(payload, 'Products'));
}

function handleResourceCreateProduct(auth, payload) {
  return handleResourceCreateRecord(auth, attachResourceName(payload, 'Products'));
}

function handleResourceUpdateProduct(auth, payload) {
  return handleResourceUpdateRecord(auth, attachResourceName(payload, 'Products'));
}

function handleResourceHealth(auth) {
  return {
    success: true,
    data: {
      scope: 'master',
      userId: auth.user.UserID,
      roleIds: auth.roleIds || []
    }
  };
}

function buildMasterSchemaFromResourceConfig(config) {
  const defaults = config && typeof config.defaultValues === 'object' && config.defaultValues !== null
    ? config.defaultValues
    : {};

  if (defaults.Status === undefined) {
    defaults.Status = 'Active';
  }

  return {
    requiredHeaders: (config && Array.isArray(config.requiredHeaders)) ? config.requiredHeaders : [],
    uniqueHeaders: (config && Array.isArray(config.uniqueHeaders)) ? config.uniqueHeaders : [],
    uniqueCompositeHeaders: (config && Array.isArray(config.uniqueCompositeHeaders)) ? config.uniqueCompositeHeaders : [],
    defaults: defaults
  };
}

function resolveResourceName(payload) {
  const resourceNames = resolveResourceNames(payload);
  if (!resourceNames.length) {
    throw new Error('Master resource is required');
  }
  return resourceNames[0];
}

function resolveResourceNames(payload) {
  const candidates = extractRequestedResourceCandidates(payload);
  if (!candidates.length) {
    return [];
  }

  const scopeProvided = !!(payload && payload.scope);
  const requestedScope = scopeProvided
    ? normalizeResourceScope(payload.scope)
    : '';
  let supported = [];
  if (scopeProvided) {
    supported = getResourcesByScope(requestedScope).map(function (config) {
      return config.name;
    });
  } else {
    const scopes = getConfiguredScopes();
    scopes.forEach(function (scopeName) {
      const names = getResourcesByScope(scopeName).map(function (config) {
        return config.name;
      });
      supported = supported.concat(names);
    });
  }
  const canonicalMap = {};
  supported.forEach(function (name) {
    const variants = getResourceNameVariants(name);
    variants.forEach(function (variant) {
      canonicalMap[variant] = name;
    });
  });

  return candidates.map(function (candidate) {
    const key = normalizeResourceAlias(candidate);
    const match = canonicalMap[key];
    if (!match) {
      if (scopeProvided) {
        throw new Error('Unsupported resource "' + candidate + '" for scope "' + requestedScope + '"');
      }
      throw new Error('Unsupported resource "' + candidate + '"');
    }
    return match;
  });
}

function attachResourceName(payload, resourceName) {
  const source = payload || {};
  const cloned = {};
  Object.keys(source).forEach(function (key) {
    cloned[key] = source[key];
  });
  cloned.resource = resourceName;
  return cloned;
}

function enforceActionPermission(auth, resourceName, actionName) {
  const roleIds = auth && Array.isArray(auth.roleIds) ? auth.roleIds : [];
  if (hasRoleActionPermission(roleIds, resourceName, actionName)) return;
  if (hasRolePermission(roleIds, resourceName, 'canUpdate')) return;
  throw new Error('Access denied for ' + resourceName + ' (' + actionName + ')');
}

function enforceMasterPermission(auth, resourceName, permissionName) {
  const roleIds = auth && Array.isArray(auth.roleIds) ? auth.roleIds : [];

  if (permissionName === 'canRead') {
    if (getReadableResourceNameSet(roleIds)[resourceName]) return;
  }

  const allowed = hasRolePermission(roleIds, resourceName, permissionName);
  if (!allowed) {
    throw new Error('Access denied for ' + resourceName + ' (' + permissionName + ')');
  }
}

function buildResourceRowsResponse(auth, resourceName, resource, rows, lastUpdatedAt, headersInput) {
  const headers = Array.isArray(headersInput) && headersInput.length
    ? headersInput
    : getSheetHeadersByMeta(resource.config.fileId, resource.config.sheetName, resource.sheet);
  const idx = getHeaderIndexMap(headers);
  let nameToCodeMap = null;
  const scope = buildAuthAccessRegionScope(auth);
  const regionSource = resource && resource.config && resource.config.accessRegionSource;
  if (regionSource && regionSource.self && regionSource.self.resolve) {
    if (auth && auth._nameToRegionCodeMap) {
      nameToCodeMap = auth._nameToRegionCodeMap;
    } else {
      nameToCodeMap = buildUserNameToRegionCodeMap(scope);
      if (auth) auth._nameToRegionCodeMap = nameToCodeMap;
    }
  }
  const filteredRows = rows.filter(function (row) {
    return canAccessRowByPolicy(auth, resource.config, row, idx, nameToCodeMap, scope);
  });

  let maxUpdatedAt = 0;
  const updatedAtIdx = idx.UpdatedAt;
  if (updatedAtIdx !== undefined) {
    for (let i = 0; i < rows.length; i++) {
      let ts = normalizeUpdatedAtMillis(rows[i][updatedAtIdx]);
      if (ts > maxUpdatedAt) maxUpdatedAt = ts;
    }
  }

  if (maxUpdatedAt) {
    // Keep the dynamic cursor store honest even when the write path was
    // bypassed (manual sheet edits, imports, formula-driven rows).
    bumpResourceSyncCursorCache(resourceName, maxUpdatedAt);
  } else {
    // Delta read returned nothing new: report the stored cursor rather than 0,
    // so the client never rewinds its own lastDataUpdatedAt.
    try {
      maxUpdatedAt = getResourceSyncCursor(resourceName) || 0;
    } catch (e) {
      maxUpdatedAt = 0;
    }
  }

  return {
    success: true,
    rows: filteredRows,
    headers: headers,
    meta: {
      resource: resourceName,
      fileId: resource.config.fileId,
      sheetName: resource.config.sheetName,
      requestedBy: auth && auth.user ? auth.user.UserID : null,
      hasDeltaFilter: !!lastUpdatedAt,
      lastDataUpdatedAt: maxUpdatedAt,
      lastSyncAt: Date.now()
    }
  };
}

function normalizeUpdatedAtMillis(value) {
  if (value === '' || value === null || value === undefined) return 0;
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  if (value instanceof Date) {
    var t = value.getTime();
    return isNaN(t) ? 0 : t;
  }
  var numeric = Number(value);
  if (isFinite(numeric) && numeric > 0) return numeric;
  var parsed = parseDateInput(value);
  return parsed ? parsed.getTime() : 0;
}

function enforceRecordLevelAccess(auth, resourceConfig, headers, rowValues) {
  const idx = getHeaderIndexMap(headers || []);
  if (!canAccessRowByPolicy(auth, resourceConfig, rowValues, idx)) {
    throw new Error('Access denied by record-level policy');
  }
}

function canAccessRowByPolicy(auth, resourceConfig, rowValues, idx, nameToCodeMap, scope) {
  if (!requiresAccessRegionCheck(auth, idx, resourceConfig, scope)) {
    return true;
  }
  return canAccessRowByAccessRegion(auth, rowValues, idx, resourceConfig, nameToCodeMap, scope);
}

function requiresAccessRegionCheck(auth, idx, resourceConfig, scope) {
  const regionHeader = resolveAccessRegionHeader(idx, resourceConfig);
  if (!regionHeader) return false;
  if (!scope) scope = buildAuthAccessRegionScope(auth);
  return !scope.isUniverse;
}

function extractProvidedHeaderValues(headers, payload) {
  const result = {};
  const sourceRecord = payload && typeof payload.record === 'object' && payload.record !== null ? payload.record : {};
  const sourcePayload = payload || {};
  const normalizedRecord = buildNormalizedValueMap(sourceRecord);
  const normalizedPayload = buildNormalizedValueMap(sourcePayload);

  headers.forEach(function (header) {
    const key = normalizeFieldKey(header);
    if (key in normalizedRecord) {
      result[header] = normalizedRecord[key];
      return;
    }

    if (key in normalizedPayload) {
      result[header] = normalizedPayload[key];
    }
  });

  return result;
}

function buildNormalizedValueMap(source) {
  const map = {};
  Object.keys(source || {}).forEach(function (key) {
    map[normalizeFieldKey(key)] = source[key];
  });
  return map;
}

function normalizeFieldKey(value) {
  const source = (value || '').toString().toLowerCase();
  let normalized = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source.charAt(i);
    const isAlpha = ch >= 'a' && ch <= 'z';
    const isNum = ch >= '0' && ch <= '9';
    if (isAlpha || isNum) {
      normalized += ch;
    }
  }
  return normalized;
}

function resolveCodeValue(payload) {
  if (!payload) return '';
  if (payload.code !== undefined && payload.code !== null && payload.code !== '') {
    return payload.code;
  }
  if (payload.Code !== undefined && payload.Code !== null && payload.Code !== '') {
    return payload.Code;
  }
  if (payload.record && payload.record.Code) {
    return payload.record.Code;
  }
  return '';
}

function buildNewResourceRow(headers, idx, providedValues, schema) {
  const row = new Array(headers.length).fill('');

  headers.forEach(function (header) {
    const headerIndex = idx[header];
    if (header === 'Code' || isAuditHeader(header)) {
      return;
    }

    if (providedValues[header] !== undefined) {
      row[headerIndex] = normalizeValueByHeader(header, providedValues[header]);
      return;
    }

    if (schema.defaults && schema.defaults[header] !== undefined) {
      row[headerIndex] = schema.defaults[header];
      return;
    }

    if (header === 'Status') {
      row[headerIndex] = 'Active';
    }
  });

  return row;
}

function mergeMasterRow(existingRow, idx, providedValues, schema) {
  const row = existingRow.slice();
  Object.keys(providedValues).forEach(function (header) {
    if (header === 'Code' || isAuditHeader(header) || idx[header] === undefined) {
      return;
    }
    row[idx[header]] = normalizeValueByHeader(header, providedValues[header]);
  });

  if (idx.Status !== undefined && isGenericLifecycleStatus(row[idx.Status])) {
    if (!row[idx.Status]) {
      row[idx.Status] = schema.defaults && schema.defaults.Status ? schema.defaults.Status : 'Active';
    }
    row[idx.Status] = sanitizeStatus(row[idx.Status]);
  }

  return row;
}

function canAccessRowByAccessRegion(auth, rowValues, idx, resourceConfig, nameToCodeMap, scope) {
  const regionHeader = resolveAccessRegionHeader(idx, resourceConfig);
  if (!regionHeader) return true;

  const rawVal = (rowValues[idx[regionHeader]] || '').toString().trim();
  const selfRule = resourceConfig && resourceConfig.accessRegionSource && resourceConfig.accessRegionSource.self;
  let regionCode = '';

  if (selfRule && selfRule.resolve === true) {
    if (!rawVal) return true;
    const lower = rawVal.toLowerCase();
    const map = nameToCodeMap || (auth && auth._nameToRegionCodeMap) || (function() {
      if (!scope) scope = buildAuthAccessRegionScope(auth);
      const m = buildUserNameToRegionCodeMap(scope);
      if (auth) auth._nameToRegionCodeMap = m;
      return m;
    })();
    regionCode = map[lower] || '';
    if (!regionCode) return false;
  } else {
    regionCode = normalizeAccessRegionCode(rawVal);
    if (!regionCode) return true;
  }

  if (!scope) scope = buildAuthAccessRegionScope(auth);
  if (scope.isUniverse) return true;

  const resName = resourceConfig && resourceConfig.name ? resourceConfig.name : '';
  // LEGACY: delete in next release.
  if (!auth.regions) {
    auth.regions = {};
  }
  // Covers resources added to APP.Resources after login.
  if (!auth.regions[resName]) {
    const computed = buildUserRegions(scope, [resName]);
    auth.regions[resName] = computed[resName] || {};
  }

  const allowedRegions = auth.regions[resName] || {};
  return !!allowedRegions[regionCode];
}

function applyAccessRegionOnWrite(row, idx, auth, resourceConfig, batchContext) {
  const self = resourceConfig && resourceConfig.accessRegionSource && resourceConfig.accessRegionSource.self;
  if (self && self.resolve === true) return;

  const targetCol = (self && self.column) ? self.column : 'AccessRegion';

  if (!idx || typeof idx !== 'object' || idx[targetCol] === undefined) return;
  const colIndex = idx[targetCol];

  const existingVal = (row[colIndex] !== undefined && row[colIndex] !== null) ? row[colIndex].toString().trim() : '';
  if (existingVal !== '') return;

  const resolvedCode = resolveAccessRegionOnWriteFallback(row, idx, auth, resourceConfig, batchContext);
  if (resolvedCode) {
    row[colIndex] = resolvedCode;
  }
}

function resolveAccessRegionOnWriteFallback(row, idx, auth, resourceConfig, batchContext) {
  const scope = buildAuthAccessRegionScope(auth);
  const userRegion = scope.assignedCode ? normalizeAccessRegionCode(scope.assignedCode) : '';
  const rule = resourceConfig && resourceConfig.accessRegionSource;

  if (!rule || !Array.isArray(rule.subject) || !rule.subject.length) {
    return userRegion;
  }

  const batch = batchContext || {};
  if (!batch.configs) batch.configs = {};
  if (!batch.rows) batch.rows = {};
  if (!batch.nameToCodeMap) batch.nameToCodeMap = buildUserNameToRegionCodeMap(scope);

  const subjects = rule.subject;
  let reserve = '';
  let i = 0;

  while (i < subjects.length) {
    const entry = subjects[i];
    if (!entry) {
      i++;
      continue;
    }

    if (entry.user === true) {
      return userRegion;
    }

    const colName = (entry.column || '').toString().trim();
    const cellVal = (idx[colName] !== undefined && row[idx[colName]] !== undefined && row[idx[colName]] !== null)
      ? row[idx[colName]].toString().trim()
      : '';

    if (!cellVal) {
      if (entry.empty === 'next') {
        i++;
        continue;
      }
      break;
    }

    let targetResourceName = (entry.resource || '').toString().trim();
    if (!targetResourceName && resourceConfig && resourceConfig.relations) {
      const rel = resourceConfig.relations[colName];
      if (typeof rel === 'string') {
        targetResourceName = rel.trim();
      } else if (rel && typeof rel === 'object' && rel.resource) {
        targetResourceName = (rel.resource || '').toString().trim();
      }
    }

    let successCode = '';
    if (targetResourceName) {
      try {
        if (!batch.configs[targetResourceName]) {
          batch.configs[targetResourceName] = getResourceConfig(targetResourceName);
        }
        const targetConfig = batch.configs[targetResourceName];

        if (!batch.rows[targetResourceName]) {
          const res = openResourceSheet(targetResourceName);
          const hdrs = getSheetHeadersByMeta(res.config.fileId, res.config.sheetName, res.sheet);
          const hIdx = getHeaderIndexMap(hdrs);
          const targetSelfCol = (targetConfig && targetConfig.accessRegionSource && targetConfig.accessRegionSource.self && targetConfig.accessRegionSource.self.column)
            ? targetConfig.accessRegionSource.self.column
            : 'AccessRegion';
          const maxColIdx = Math.max(
            hIdx.Code !== undefined ? hIdx.Code : 0,
            hIdx[targetSelfCol] !== undefined ? hIdx[targetSelfCol] : 0
          );
          const maxNeededCol = Math.min(hdrs.length, maxColIdx + 1);
          const lastRow = res.sheet.getLastRow();
          const vals = (lastRow > 1 && maxNeededCol > 0)
            ? res.sheet.getRange(1, 1, lastRow, maxNeededCol).getValues()
            : [hdrs];
          const rowMap = {};
          if (hIdx.Code !== undefined) {
            for (let r = 1; r < vals.length; r++) {
              const c = (vals[r][hIdx.Code] || '').toString().trim();
              if (c && rowMap[c] === undefined) {
                rowMap[c] = vals[r];
              }
            }
          }
          batch.rows[targetResourceName] = { headers: hdrs, idx: hIdx, byCode: rowMap };
        }

        const targetData = batch.rows[targetResourceName];
        const subjectRow = targetData.byCode[cellVal];

        if (subjectRow) {
          const targetSelfCol = (targetConfig && targetConfig.accessRegionSource && targetConfig.accessRegionSource.self && targetConfig.accessRegionSource.self.column)
            ? targetConfig.accessRegionSource.self.column
            : 'AccessRegion';

          if (targetData.idx[targetSelfCol] !== undefined) {
            const rawTargetVal = (subjectRow[targetData.idx[targetSelfCol]] || '').toString().trim();
            const shouldResolve = !!(targetConfig && targetConfig.accessRegionSource && targetConfig.accessRegionSource.self && targetConfig.accessRegionSource.self.resolve);

            if (shouldResolve) {
              if (rawTargetVal) {
                const mapped = batch.nameToCodeMap[rawTargetVal.toLowerCase()];
                if (mapped) successCode = mapped;
              }
            } else {
              const norm = normalizeAccessRegionCode(rawTargetVal);
              if (norm) successCode = norm;
            }
          }
        }
      } catch (err) {
        // D47: never block the write
      }
    }

    if (successCode) {
      return successCode;
    }

    if (entry.fail === 'user') {
      reserve = userRegion;
      i++;
    } else if (typeof entry.fail === 'string' && entry.fail !== '') {
      let jumpIndex = -1;
      for (let j = 0; j < subjects.length; j++) {
        if (subjects[j] && subjects[j].column === entry.fail) {
          jumpIndex = j;
          break;
        }
      }
      if (jumpIndex !== -1) {
        i = jumpIndex;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return reserve;
}

function resolveAccessRegionHeader(idx, resourceConfig) {
  if (!idx || typeof idx !== 'object') return '';
  const selfCol = resourceConfig && resourceConfig.accessRegionSource && resourceConfig.accessRegionSource.self && resourceConfig.accessRegionSource.self.column;
  if (selfCol && idx[selfCol] !== undefined) return selfCol;
  if (idx.AccessRegion !== undefined) return 'AccessRegion';
  return '';
}

function normalizeValueByHeader(header, value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (header === 'Status') {
    return isGenericLifecycleStatus(value) ? sanitizeStatus(value) : value.toString().trim();
  }
  return value;
}

function applyAuditFields(row, idx, auth, resourceConfig, isCreate) {
  const now = Date.now();

  if (resourceConfig.audit) {
    if (isCreate && idx.CreatedAt !== undefined) row[idx.CreatedAt] = now;
    if (idx.UpdatedAt !== undefined) row[idx.UpdatedAt] = now;
    if (idx.Revision !== undefined) {
      if (isCreate) {
        row[idx.Revision] = 1;
      } else {
        const curRev = Number(row[idx.Revision]);
        row[idx.Revision] = (!curRev || isNaN(curRev) || curRev < 0) ? 1 : curRev + 1;
      }
    }
    if (isCreate && idx.CreatedBy !== undefined) row[idx.CreatedBy] = auth.user.UserID;
    if (idx.UpdatedBy !== undefined) row[idx.UpdatedBy] = auth.user.UserID;
  }

  return now;
}

function validateRequiredFields(row, idx, requiredHeaders, resourceName) {
  (requiredHeaders || []).forEach(function (header) {
    const headerIdx = idx[header];
    if (headerIdx === undefined) return;

    const value = (row[headerIdx] || '').toString().trim();
    if (!value) {
      throw new Error(resourceName + ': ' + header + ' is required');
    }
  });
}

function validateMasterUniqueness(values, idx, candidateRow, schema, excludeRowNumber, resourceName, index) {
  const state = index || {};
  if (!state.groups) {
    state.groups = [];
    (schema.uniqueHeaders || []).forEach(function(header) {
      if (idx[header] !== undefined) state.groups.push({ headers: [header], message: 'duplicate value for ' + header });
    });
    (schema.uniqueCompositeHeaders || []).forEach(function(headers) {
      if (headers && headers.length && headers.every(function(header) { return idx[header] !== undefined; })) {
        state.groups.push({ headers, message: 'duplicate combination for ' + headers.join('+') });
      }
    });
    state.groups.forEach(function(group) { group.keys = new Map(); group.rows = new Map(); });
    state.length = 1;
    state.changedRows = [];
  }
  if (!state.groups.length) return;
  const changed = new Set(state.changedRows);
  for (let i = state.length; i < values.length; i++) changed.add(i);
  changed.forEach(function(rowIndex) {
    state.groups.forEach(function(group) {
      const previous = group.rows.get(rowIndex);
      if (previous !== undefined) group.keys.get(previous).delete(rowIndex);
      group.rows.delete(rowIndex);
      const parts = group.headers.map(function(header) { return normalizeForComparison(values[rowIndex][idx[header]]); });
      if (parts.some(function(part) { return !part; })) return;
      const key = JSON.stringify(parts);
      if (!group.keys.has(key)) group.keys.set(key, new Set());
      group.keys.get(key).add(rowIndex);
      group.rows.set(rowIndex, key);
    });
  });
  state.changedRows = [];
  state.length = values.length;
  let firstRow = Infinity;
  let message = '';
  state.groups.forEach(function(group) {
    const parts = group.headers.map(function(header) { return normalizeForComparison(candidateRow[idx[header]]); });
    if (parts.some(function(part) { return !part; })) return;
    const matches = group.keys.get(JSON.stringify(parts));
    if (!matches) return;
    matches.forEach(function(rowIndex) {
      if (rowIndex + 1 !== excludeRowNumber && rowIndex < firstRow) {
        firstRow = rowIndex;
        message = group.message;
      }
    });
  });
  if (message) throw new Error(resourceName + ': ' + message);
}

function normalizeForComparison(value) {
  return (value || '').toString().trim().toLowerCase();
}

function sanitizeRequiredText(value, message) {
  const normalized = (value || '').toString().trim();
  if (!normalized) {
    throw new Error(message || 'Value is required');
  }
  return normalized;
}

function sanitizeStatus(value) {
  const normalized = (value || 'Active').toString().trim();
  return normalized === 'Inactive' ? 'Inactive' : 'Active';
}

function isGenericLifecycleStatus(value) {
  const normalized = (value || '').toString().trim();
  return normalized === 'Active' || normalized === 'Inactive';
}

function isAuditHeader(header) {
  return header === 'CreatedAt' || header === 'UpdatedAt' || header === 'Revision' || header === 'CreatedBy' || header === 'UpdatedBy';
}

function generateNextCode(values, idx, prefix, sequenceLength) {
  let sequences = _code_sequence_cache.get(values);
  if (!sequences) {
    sequences = new Map();
    _code_sequence_cache.set(values, sequences);
  }
  const key = JSON.stringify([idx.Code, prefix]);
  let sequence = sequences.get(key);
  if (!sequence || sequence.length > values.length) {
    sequence = { length: 1, max: 0, pattern: new RegExp('^' + escapeRegex(prefix) + '(\\d+)$') };
    sequences.set(key, sequence);
  }
  for (let i = sequence.length; i < values.length; i++) {
    const match = (values[i][idx.Code] || '').toString().trim().match(sequence.pattern);
    if (match) sequence.max = Math.max(sequence.max, Number(match[1]));
  }
  sequence.length = values.length;
  return prefix + padSequence(sequence.max + 1, sequenceLength);
}

function generateNextYearScopedCode(values, idx, prefix, sequenceLength) {
  const year = new Date().getFullYear().toString().slice(-2);
  return generateNextCode(values, idx, prefix + year, sequenceLength);
}

function escapeRegex(value) {
  return (value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function padSequence(numberValue, sequenceLength) {
  const digits = Math.max(1, Number(sequenceLength) || 6);
  const str = String(numberValue);
  if (str.length >= digits) {
    return str;
  }
  return '0'.repeat(digits - str.length) + str;
}

function parseDateInput(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const num = Number(value);
  if (Number.isFinite(num)) {
    const parsedNum = new Date(num);
    return isNaN(parsedNum.getTime()) ? null : parsedNum;
  }

  const parsedStr = new Date(String(value));
  return isNaN(parsedStr.getTime()) ? null : parsedStr;
}

function extractRequestedResourceCandidates(payload) {
  const source = payload || {};
  const result = [];

  if (Array.isArray(source.resources)) {
    source.resources.forEach(function (item) {
      const value = extractResourceNameFromCandidate(item);
      if (value) result.push(value);
    });
  } else if (typeof source.resources === 'string') {
    source.resources.split(',').forEach(function (item) {
      const value = (item || '').toString().trim();
      if (value) result.push(value);
    });
  }

  if (Array.isArray(source.resource)) {
    source.resource.forEach(function (item) {
      const value = extractResourceNameFromCandidate(item);
      if (value) result.push(value);
    });
  } else if (source.resource !== undefined && source.resource !== null && source.resource !== '') {
    const value = source.resource.toString().trim();
    if (value) result.unshift(value);
  }

  // Deduplicate while preserving order
  const unique = [];
  const seen = {};
  result.forEach(function (item) {
    const key = item.toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      unique.push(item);
    }
  });

  return unique;
}

function normalizeResourceAlias(value) {
  let key = (value || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key.endsWith('s')) {
    key = key.slice(0, -1);
  }
  return key;
}

function getResourceNameVariants(resourceName) {
  const singular = normalizeResourceAlias(resourceName);
  return [singular, singular + 's'];
}

function cloneWithResource(payload, resourceName) {
  const source = payload || {};
  const cloned = {};
  Object.keys(source).forEach(function (key) {
    cloned[key] = source[key];
  });
  cloned.resource = resourceName;
  return cloned;
}

function resolveMultiResourceCursor(payload, resourceName) {
  const source = payload || {};
  const resourceKey = normalizeResourceAlias(resourceName);

  var cursorFromMap = readCursorFromMap(source.lastUpdatedAtByResource, resourceKey);
  if (cursorFromMap === null || cursorFromMap === undefined || cursorFromMap === '') {
    cursorFromMap = readCursorFromMap(source.resourceCursors, resourceKey);
  }
  if (cursorFromMap === null || cursorFromMap === undefined || cursorFromMap === '') {
    cursorFromMap = readCursorFromMap(source.cursors, resourceKey);
  }
  if (cursorFromMap !== null && cursorFromMap !== undefined && cursorFromMap !== '') {
    return cursorFromMap;
  }

  if (Array.isArray(source.resources)) {
    for (var i = 0; i < source.resources.length; i++) {
      var item = source.resources[i];
      if (!item || typeof item !== 'object') {
        continue;
      }

      var candidateName = extractResourceNameFromCandidate(item);
      if (!candidateName) {
        continue;
      }

      if (normalizeResourceAlias(candidateName) !== resourceKey) {
        continue;
      }

      if (item.lastUpdatedAt !== undefined && item.lastUpdatedAt !== null && item.lastUpdatedAt !== '') {
        return item.lastUpdatedAt;
      }
    }
  }

  if (source.lastUpdatedAt !== undefined && source.lastUpdatedAt !== null && source.lastUpdatedAt !== '') {
    return source.lastUpdatedAt;
  }

  return null;
}

function readCursorFromMap(cursorMap, resourceKey) {
  if (!cursorMap || typeof cursorMap !== 'object') {
    return null;
  }

  var keys = Object.keys(cursorMap);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (normalizeResourceAlias(key) !== resourceKey) {
      continue;
    }
    return cursorMap[key];
  }

  return null;
}

function extractResourceNameFromCandidate(candidate) {
  if (candidate === null || candidate === undefined) {
    return '';
  }

  if (typeof candidate === 'string') {
    return candidate.toString().trim();
  }

  if (typeof candidate === 'object') {
    if (candidate.resource !== undefined && candidate.resource !== null && candidate.resource !== '') {
      return candidate.resource.toString().trim();
    }
    if (candidate.name !== undefined && candidate.name !== null && candidate.name !== '') {
      return candidate.name.toString().trim();
    }
  }

  return '';
}

function mergeDeltaResourcesIntoResult(baseData, deltaByResource) {
  var merged = {};
  var source = baseData && typeof baseData === 'object' ? baseData : {};
  Object.keys(source).forEach(function (key) {
    merged[key] = source[key];
  });

  var deltas = deltaByResource && typeof deltaByResource === 'object' ? deltaByResource : {};
  Object.keys(deltas).forEach(function (resourceName) {
    merged[resourceName] = deltas[resourceName];
  });

  return merged;
}

function mergeWrittenRowsIntoResourcePayload(resourcePayload, resourceConfig, headers, writtenRows) {
  var payload = resourcePayload && typeof resourcePayload === 'object' ? resourcePayload : {};
  var rows = Array.isArray(payload.rows) ? payload.rows.slice() : [];
  var outputHeaders = Array.isArray(payload.headers) && payload.headers.length ? payload.headers : headers;
  var codeIdx = outputHeaders.indexOf('Code');
  var seen = {};

  if (codeIdx !== -1) {
    rows.forEach(function (row) {
      var code = Array.isArray(row) ? (row[codeIdx] || '').toString().trim() : '';
      if (code) seen[code] = true;
    });
  }

  (Array.isArray(writtenRows) ? writtenRows : []).forEach(function (row) {
    if (!Array.isArray(row)) return;
    var code = codeIdx !== -1 ? (row[codeIdx] || '').toString().trim() : '';
    if (code && seen[code]) return;
    if (code) seen[code] = true;
    rows.push(row);
  });

  return {
    success: payload.success !== false,
    headers: outputHeaders,
    rows: rows,
    meta: Object.assign({}, payload.meta || {}, {
      resource: payload.meta && payload.meta.resource ? payload.meta.resource : '',
      fileId: payload.meta && payload.meta.fileId ? payload.meta.fileId : (resourceConfig && resourceConfig.fileId ? resourceConfig.fileId : ''),
      sheetName: payload.meta && payload.meta.sheetName ? payload.meta.sheetName : (resourceConfig && resourceConfig.sheetName ? resourceConfig.sheetName : ''),
      lastSyncAt: payload.meta && payload.meta.lastSyncAt ? payload.meta.lastSyncAt : Date.now()
    })
  };
}

function collectWriteDeltaResources(auth, payload, resourceNames) {
  let names = Array.isArray(resourceNames) ? resourceNames : [];
  if (!names.length) {
    return {};
  }

  let unique = [];
  let seen = {};
  names.forEach(function (name) {
    let normalized = (name || '').toString().trim();
    if (!normalized) return;
    let key = normalized.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    unique.push(normalized);
  });

  let deltas = {};
  unique.forEach(function (resourceName) {
    let readPayload = cloneWithResource(payload, resourceName);

    let cursor = resolveMultiResourceCursor(payload, resourceName);
    if (cursor !== null && cursor !== undefined && cursor !== '') {
      readPayload.lastUpdatedAt = cursor;
    } else {
      delete readPayload.lastUpdatedAt;
    }

    const plan = _activeBatchWritePlan;
    let cacheKey = '';
    if (plan) {
      const config = getResourceConfig(resourceName);
      const entry = Array.from(plan.sheets.values()).find(function(item) {
        return item.fileId === config.fileId && item.sheetName === config.sheetName;
      });
      if (entry) cacheKey = JSON.stringify([resourceName, cursor, entry.version]);
      if (cacheKey && plan.deltaReads.has(cacheKey)) {
        deltas[resourceName] = plan.deltaReads.get(cacheKey);
        return;
      }
    }
    deltas[resourceName] = handleResourceGetRecords(auth, readPayload);
    if (cacheKey) plan.deltaReads.set(cacheKey, deltas[resourceName]);
  });

  return deltas;
}

function buildDirectWriteResourcePayload(resourceName, resourceConfig, headers, rows, auth, lastDataUpdatedAt) {
  var maxUpdatedAt = normalizeUpdatedAtMillis(lastDataUpdatedAt) || 0;
  if (!maxUpdatedAt && Array.isArray(rows) && rows.length && Array.isArray(headers)) {
    var updatedAtIdx = headers.indexOf('UpdatedAt');
    if (updatedAtIdx !== -1) {
      for (var i = 0; i < rows.length; i++) {
        var ts = normalizeUpdatedAtMillis(rows[i][updatedAtIdx]);
        if (ts > maxUpdatedAt) maxUpdatedAt = ts;
      }
    }
  }
  if (!maxUpdatedAt) {
    try {
      maxUpdatedAt = getResourceSyncCursor(resourceName) || 0;
    } catch (e) {
      maxUpdatedAt = 0;
    }
  }

  return {
    success: true,
    rows: Array.isArray(rows) ? rows : [],
    headers: Array.isArray(headers) ? headers : [],
    meta: {
      resource: resourceName,
      fileId: resourceConfig && resourceConfig.fileId ? resourceConfig.fileId : '',
      sheetName: resourceConfig && resourceConfig.sheetName ? resourceConfig.sheetName : '',
      requestedBy: auth && auth.user ? auth.user.UserID : null,
      directWrite: true,
      lastDataUpdatedAt: maxUpdatedAt || Date.now(),
      lastSyncAt: Date.now()
    }
  };
}

function buildCompositeDirectWriteResources(parentResourceName, parentConfig, parentHeaders, parentRowData, childWriteOps, auth, parentTimestamp) {
  var resources = {};
  resources[parentResourceName] = buildDirectWriteResourcePayload(
    parentResourceName,
    parentConfig,
    parentHeaders,
    [parentRowData],
    auth,
    parentTimestamp
  );

  (childWriteOps || []).forEach(function (ops) {
    var rows = [];
    if (Array.isArray(ops.newRows)) {
      rows = rows.concat(ops.newRows);
    }
    if (Array.isArray(ops.updateOps)) {
      ops.updateOps.forEach(function (op) {
        if (op && Array.isArray(op.rowData)) {
          rows.push(op.rowData);
        }
      });
    }
    resources[ops.resourceName] = buildDirectWriteResourcePayload(
      ops.resourceName,
      ops.config,
      ops.headers,
      rows,
      auth,
      ops.maxTimestamp
    );
  });

  return resources;
}

function handleCompositeSave(auth, payload) {
  let parentResourceName = (payload.resource || '').toString().trim();
  if (!parentResourceName) {
    return { success: false, message: 'Resource is required for composite save' };
  }

  let isEdit = !!(payload.code && payload.code.toString().trim());
  let parentData = payload && typeof payload.data === 'object' && payload.data !== null ? payload.data : null;
  if (!parentData || Array.isArray(parentData)) {
    return { success: false, message: 'Composite save requires payload.data' };
  }
  if (payload.children != null && !Array.isArray(payload.children)) {
    return { success: false, message: 'Composite children must be an array' };
  }
  let childrenPayload = payload.children || [];

  // Phase 1: Validate everything
  let validationErrors = [];
  let compositeBatchContext = { configs: {}, rows: {}, nameToCodeMap: null };
  let parentResource = openResourceSheet(parentResourceName);
  let parentSchema = buildMasterSchemaFromResourceConfig(parentResource.config);

  let parentSheet = parentResource.sheet;
  let parentHeaders = getSheetHeadersByMeta(parentResource.config.fileId, parentResource.config.sheetName, parentSheet);
  let parentIdx = getHeaderIndexMap(parentHeaders);

  let parentMaxColIdx = parentIdx.Code !== undefined ? parentIdx.Code : 0;
  (parentSchema.uniqueHeaders || []).forEach(function (h) {
    if (parentIdx[h] !== undefined && parentIdx[h] > parentMaxColIdx) parentMaxColIdx = parentIdx[h];
  });
  (parentSchema.uniqueCompositeHeaders || []).forEach(function (combo) {
    (combo || []).forEach(function (h) {
      if (parentIdx[h] !== undefined && parentIdx[h] > parentMaxColIdx) parentMaxColIdx = parentIdx[h];
    });
  });
  let parentMaxNeededCol = Math.min(parentHeaders.length, parentMaxColIdx + 1);
  if (parentMaxNeededCol < 1) parentMaxNeededCol = 1;

  let parentLastRow = parentSheet.getLastRow();

  let parentValues;
  if (parentLastRow > 1) {
    parentValues = parentSheet.getRange(1, 1, parentLastRow, parentMaxNeededCol).getValues();
  } else {
    parentValues = [parentHeaders.slice(0, parentMaxNeededCol)];
  }

  // Build parent row
  let providedParentCode = resolveCodeValue({ record: parentData });
  let parentProvidedValues = {};
  Object.keys(parentData).forEach(function(key) {
    if (key === 'Code' || isAuditHeader(key)) return;
    parentProvidedValues[key] = parentData[key];
  });

  let parentCode;
  let parentRowData;
  let parentRowNumber = -1;

  let parentTimestamp = 0;
  if (isEdit) {
    parentCode = payload.code.toString().trim();
    parentRowNumber = findRowByValue(parentSheet, parentIdx.Code, parentCode, 2, true, parentValues);
    if (parentRowNumber === -1) {
      return { success: false, message: parentResourceName + ' record not found: ' + parentCode };
    }
    let existingRow = parentMaxNeededCol === parentHeaders.length
      ? parentValues[parentRowNumber - 1].slice()
      : parentSheet.getRange(parentRowNumber, 1, 1, parentHeaders.length).getValues()[0];
    enforceRecordLevelAccess(auth, parentResource.config, parentHeaders, existingRow);
    parentRowData = mergeMasterRow(existingRow, parentIdx, parentProvidedValues, parentSchema);
    parentRowData[parentIdx.Code] = parentCode;
    parentTimestamp = applyAuditFields(parentRowData, parentIdx, auth, parentResource.config, false);
  } else {
    parentCode = providedParentCode;
    if (!parentCode) {
      let codePrefix = (parentResource.config.codePrefix || '').toString().trim();
      if (!codePrefix) {
        return { success: false, message: 'CodePrefix is missing for resource: ' + parentResourceName };
      }
      let seqLength = parentResource.config.codeSequenceLength || 6;
      parentCode = parentResource.config.scope === 'operation'
        ? generateNextYearScopedCode(parentValues, parentIdx, codePrefix, seqLength)
        : generateNextCode(parentValues, parentIdx, codePrefix, seqLength);
    }
    parentRowData = buildNewResourceRow(parentHeaders, parentIdx, parentProvidedValues, parentSchema);
    parentRowData[parentIdx.Code] = parentCode;
    applyAccessRegionOnWrite(parentRowData, parentIdx, auth, parentResource.config, compositeBatchContext);
    parentTimestamp = applyAuditFields(parentRowData, parentIdx, auth, parentResource.config, true);
  }

  // Validate parent
  try {
    validateRequiredFields(parentRowData, parentIdx, parentSchema.requiredHeaders, parentResourceName);
    validateMasterUniqueness(parentValues, parentIdx, parentRowData, parentSchema, parentRowNumber, parentResourceName);
  } catch (err) {
    validationErrors.push({ resource: parentResourceName, message: err.message || err.toString() });
  }

  // Phase 1b: Validate all children
  let childWriteOps = [];
  const childResourceNames = new Set();

  for (let c = 0; c < childrenPayload.length; c++) {
    let childGroup = childrenPayload[c];
    let childResourceName = childGroup && (childGroup.resource || '').toString().trim();
    if (!childResourceName || childResourceName === parentResourceName ||
        !Array.isArray(childGroup.records) || childResourceNames.has(childResourceName)) {
      validationErrors.push({ resource: childResourceName || parentResourceName, message: 'Each child resource needs one records array' });
      continue;
    }
    childResourceNames.add(childResourceName);
    let childRecords = childGroup.records;
    if (!childRecords.length) continue;

    let childResource = openResourceSheet(childResourceName);
    let childSchema = buildMasterSchemaFromResourceConfig(childResource.config);
    let childSheet = childResource.sheet;
    let childHeaders = getSheetHeadersByMeta(childResource.config.fileId, childResource.config.sheetName, childSheet);
    let childIdx = getHeaderIndexMap(childHeaders);
    const parentCodeField = resolveParentCodeField(childHeaders, parentResourceName);
    if (!parentCodeField) {
      validationErrors.push({ resource: childResourceName, message: 'Child parent-code column is missing' });
      continue;
    }
    let childCodePrefix = (childResource.config.codePrefix || '').toString().trim();
    let childSeqLength = childResource.config.codeSequenceLength || 6;

    let childMaxColIdx = childIdx.Code !== undefined ? childIdx.Code : 0;
    (childSchema.uniqueHeaders || []).forEach(function (h) {
      if (childIdx[h] !== undefined && childIdx[h] > childMaxColIdx) childMaxColIdx = childIdx[h];
    });
    (childSchema.uniqueCompositeHeaders || []).forEach(function (combo) {
      (combo || []).forEach(function (h) {
        if (childIdx[h] !== undefined && childIdx[h] > childMaxColIdx) childMaxColIdx = childIdx[h];
      });
    });
    let childMaxNeededCol = Math.min(childHeaders.length, childMaxColIdx + 1);
    if (childMaxNeededCol < 1) childMaxNeededCol = 1;

    let childLastRow = childSheet.getLastRow();
    const existingChildren = childRecords.filter(function(record) {
      return record && (record._action === 'update' || record._action === 'deactivate');
    });
    if (existingChildren.length >= Math.max(2, Math.ceil((childLastRow - 1) / 4))) {
      childMaxNeededCol = childHeaders.length;
    }

    let childValues;
    if (childLastRow > 1) {
      childValues = childSheet.getRange(1, 1, childLastRow, childMaxNeededCol).getValues();
    } else {
      childValues = [childHeaders.slice(0, childMaxNeededCol)];
    }
    if (_activeBatchWritePlan && childMaxNeededCol < childHeaders.length && existingChildren.length) {
      const rowNumbers = existingChildren.map(function(record) {
        const code = (record._originalCode || (record.data && record.data.Code) || '').toString().trim();
        return findRowByValue(childSheet, childIdx.Code, code, 2, true, childValues);
      });
      getBatchSheetView(_activeBatchWritePlan, childSheet, null, { rows: rowNumbers, width: childHeaders.length });
    }
    let childCurrentValues = childValues.slice();
    const childUniquenessIndex = {};
    const childCodes = new Set();

    const childOps = {
      resourceName: childResourceName, config: childResource.config, sheet: childSheet, headers: childHeaders,
      newRows: [], updateOps: [], maxTimestamp: 0, lastRow: childLastRow
    };

    for (let r = 0; r < childRecords.length; r++) {
      let rec = childRecords[r];
      try {
        if (!rec || !rec.data || typeof rec.data !== 'object' || Array.isArray(rec.data)) {
          throw new Error('Child data must be an object');
        }
        let recData = rec.data;
        let recAction = rec._action || 'create';
        if (['create', 'update', 'deactivate'].indexOf(recAction) === -1) throw new Error('Invalid child action: ' + recAction);
        let childProvidedValues = {};
        Object.keys(recData).forEach(function(key) {
          if (key === 'Code' || isAuditHeader(key)) return;
          childProvidedValues[key] = recData[key];
        });

        childProvidedValues[parentCodeField] = parentCode;

        let originalCode = (rec._originalCode || recData.Code || '').toString().trim();
        let nextCode = (recData.Code || originalCode || '').toString().trim();
        if (recAction !== 'create' && !originalCode) throw new Error('Child code is required for ' + recAction);
        if (originalCode && childCodes.has(originalCode)) throw new Error('Duplicate child code: ' + originalCode);
        if (originalCode) childCodes.add(originalCode);

        if (recAction === 'deactivate' && originalCode) {
          let deactivateRowNum = findRowByValue(childSheet, childIdx.Code, originalCode, 2, true, childValues);
          if (deactivateRowNum === -1) throw new Error('Record not found: ' + originalCode);
          if (childIdx.Status === undefined) throw new Error('Status column is required for deactivate');
          let deactivateRow = childMaxNeededCol === childHeaders.length
            ? childValues[deactivateRowNum - 1].slice()
            : childSheet.getRange(deactivateRowNum, 1, 1, childHeaders.length).getValues()[0];
          enforceRecordLevelAccess(auth, childResource.config, childHeaders, deactivateRow);
          if (parentCodeField && String(deactivateRow[childIdx[parentCodeField]] || '').trim() !== parentCode) {
            throw new Error('Child belongs to another parent: ' + originalCode);
          }
          deactivateRow[childIdx.Status] = 'Inactive';
          let deactivateTs = applyAuditFields(deactivateRow, childIdx, auth, childResource.config, false);
          if (deactivateTs > childOps.maxTimestamp) childOps.maxTimestamp = deactivateTs;
          childOps.updateOps.push({ rowNumber: deactivateRowNum, rowData: deactivateRow });
        } else if (recAction === 'update' && originalCode) {
          let updateRowNum = findRowByValue(childSheet, childIdx.Code, originalCode, 2, true, childValues);
          if (updateRowNum === -1) {
            validationErrors.push({ resource: childResourceName, index: r, message: 'Record not found: ' + originalCode });
            continue;
          }
          let existingChildRow = childMaxNeededCol === childHeaders.length
            ? childValues[updateRowNum - 1].slice()
            : childSheet.getRange(updateRowNum, 1, 1, childHeaders.length).getValues()[0];
          enforceRecordLevelAccess(auth, childResource.config, childHeaders, existingChildRow);
          if (parentCodeField && String(existingChildRow[childIdx[parentCodeField]] || '').trim() !== parentCode) {
            throw new Error('Child belongs to another parent: ' + originalCode);
          }
          let mergedChild = mergeMasterRow(existingChildRow, childIdx, childProvidedValues, childSchema);
          mergedChild[childIdx.Code] = nextCode;
          let mergedChildTs = applyAuditFields(mergedChild, childIdx, auth, childResource.config, false);
          if (mergedChildTs > childOps.maxTimestamp) childOps.maxTimestamp = mergedChildTs;
          validateRequiredFields(mergedChild, childIdx, childSchema.requiredHeaders, childResourceName);
          validateMasterUniqueness(childCurrentValues, childIdx, mergedChild, childSchema, updateRowNum, childResourceName, childUniquenessIndex);
          childOps.updateOps.push({ rowNumber: updateRowNum, rowData: mergedChild });
          childCurrentValues[updateRowNum - 1] = mergedChild;
          childUniquenessIndex.changedRows.push(updateRowNum - 1);
          if (nextCode !== originalCode) _code_sequence_cache.delete(childCurrentValues);
        } else {
          // create
          let newChildCode = nextCode || (childResource.config.scope === 'operation'
            ? generateNextYearScopedCode(childCurrentValues, childIdx, childCodePrefix, childSeqLength)
            : generateNextCode(childCurrentValues, childIdx, childCodePrefix, childSeqLength));
          let newChildRow = buildNewResourceRow(childHeaders, childIdx, childProvidedValues, childSchema);
          newChildRow[childIdx.Code] = newChildCode;
          applyAccessRegionOnWrite(newChildRow, childIdx, auth, childResource.config, compositeBatchContext);
          let newChildTs = applyAuditFields(newChildRow, childIdx, auth, childResource.config, true);
          if (newChildTs > childOps.maxTimestamp) childOps.maxTimestamp = newChildTs;
          validateRequiredFields(newChildRow, childIdx, childSchema.requiredHeaders, childResourceName);
          validateMasterUniqueness(childCurrentValues, childIdx, newChildRow, childSchema, -1, childResourceName, childUniquenessIndex);
          childOps.newRows.push(newChildRow);
          childCurrentValues.push(newChildRow);
        }
      } catch (err) {
        validationErrors.push({ resource: childResourceName, index: r, message: err.message || err.toString() });
      }
    }

    childWriteOps.push(childOps);
  }

  // If validation errors — abort, write nothing
  if (validationErrors.length) {
    return {
      success: false,
      message: 'Validation failed',
      errors: validationErrors
    };
  }

  // Phase 2: Write everything
  // Write parent
  if (isEdit) {
    parentSheet.getRange(parentRowNumber, 1, 1, parentHeaders.length).setValues([parentRowData]);
  } else {
    let parentTargetRow = parentLastRow + 1;
    parentSheet.getRange(parentTargetRow, 1, 1, parentHeaders.length).setValues([parentRowData]);
  }
  updateResourceSyncCursor(parentResourceName, parentTimestamp);

  // Write children
  for (let w = 0; w < childWriteOps.length; w++) {
    let ops = childWriteOps[w];
    if (ops.newRows.length) {
      let startRow = ops.lastRow + 1;
      ops.sheet.getRange(startRow, 1, ops.newRows.length, ops.headers.length).setValues(ops.newRows);
    }
    for (let u = 0; u < ops.updateOps.length; u++) {
      ops.sheet.getRange(ops.updateOps[u].rowNumber, 1, 1, ops.headers.length).setValues([ops.updateOps[u].rowData]);
    }
    updateResourceSyncCursor(ops.resourceName, ops.maxTimestamp);
  }

  let childResourceResults = childWriteOps.map(function(ops) {
    return {
      resourceName: ops.resourceName,
      createdRecords: ops.newRows.map(function(row) { return rowArrayToObject(ops.headers, row); }),
      updatedRecords: ops.updateOps.map(function(op) { return rowArrayToObject(ops.headers, op.rowData); })
    };
  });
  let directResources = buildCompositeDirectWriteResources(
    parentResourceName, parentResource.config, parentHeaders, parentRowData, childWriteOps, auth, parentTimestamp
  );
  let result = {
    success: true,
    message: parentResourceName + ' saved successfully',
    data: mergeDeltaResourcesIntoResult(
      { parentCode: parentCode },
      directResources
    )
  };
  dispatchPostActionHook(parentResource.config, payload, result, auth, 'compositeSave', {
    parentRecord: rowArrayToObject(parentHeaders, parentRowData),
    childResources: childResourceResults
  }, parentResourceName);
  return result;
}

function resolveParentCodeField(childHeaders, parentResourceName) {
  if (childHeaders.indexOf('ParentCode') !== -1) return 'ParentCode';
  var singular = parentResourceName.replace(/s$/, '');
  var candidate = singular + 'Code';
  if (childHeaders.indexOf(candidate) !== -1) return candidate;
  return '';
}

function rowArrayToObject(headers, rowData) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = rowData[i];
  }
  return obj;
}

function toActionHeaderSuffix(value) {
  return (value || '').toString()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(function(part) { return part; })
    .map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

function handleExecuteAction(auth, payload) {
  var resourceName = (payload.resource || '').toString().trim();
  if (!resourceName) return { success: false, message: 'Resource is required' };

  var code = (payload.code || '').toString().trim();

  var actionName = (payload.actionName || '').toString().trim();
  if (!actionName) return { success: false, message: 'Action name is required' };

  var column = (payload.column || 'Progress').toString().trim();
  var columnValue = (payload.columnValue || '').toString().trim();
  if (!columnValue) return { success: false, message: 'Column value is required' };

  var userFields = payload.fields || {};

  enforceActionPermission(auth, resourceName, actionName);

  var resource = openResourceSheet(resourceName);
  var sheet = resource.sheet;
  var headers = getSheetHeadersByMeta(resource.config.fileId, resource.config.sheetName, sheet);
  var idx = getHeaderIndexMap(headers);

  var actionConfig = findAdditionalActionConfig(resource.config, actionName);
  var stampSuffix = toActionHeaderSuffix(columnValue);

  // The action's own fields, resolved from the trusted config: a field with no `type`
  // is never user-submittable, so its value comes from here and not from the browser.
  var sourceFields = buildActionSourceFields(actionConfig, {
    auth: auth,
    record: null,
    fields: userFields,
    column: column,
    stampSuffix: stampSuffix,
    idx: idx
  });

  if (!code) {
    if (!actionConfig || actionConfig.resourceLevel !== true) {
      return { success: false, message: 'Record code is required' };
    }
    var created = handleResourceCreateRecord(auth, { resource: resourceName, record: sourceFields });
    if (!created.success) return created;
    code = (created.data && created.data.code ? created.data.code : '').toString().trim();
    if (!code) return { success: false, message: 'Could not create the ' + resourceName + ' record for ' + actionName };
    if (!_activeBatchWritePlan) SpreadsheetApp.flush();
  }

  var rowNumber = findRowByValue(sheet, idx.Code, code, 2, true);
  if (rowNumber === -1) {
    return { success: false, message: resourceName + ' record not found: ' + code };
  }

  var existingRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  var previousRecord = rowArrayToObject(headers, existingRow);
  enforceRecordLevelAccess(auth, resource.config, headers, existingRow);

  var targetOutcome = executeActionTargets(auth, actionConfig && actionConfig.targets, {
    auth: auth,
    record: previousRecord,
    fields: userFields,
    targetFields: payload.targetFields || {},
    column: column,
    stampSuffix: stampSuffix,
    targets: {}
  });

  // Set the column value (e.g., Progress = 'Approved')
  if (idx[column] !== undefined) {
    existingRow[idx[column]] = columnValue;
  }

  var atField = column + stampSuffix + 'At';
  var byField = column + stampSuffix + 'By';
  if (idx[atField] !== undefined) existingRow[idx[atField]] = formatDateTime24();
  if (idx[byField] !== undefined) existingRow[idx[byField]] = auth.user.Name || auth.user.UserID;

  if (idx.RespondDate !== undefined) existingRow[idx.RespondDate] = formatDateTime24();

  var writeFields = {};
  Object.keys(userFields).forEach(function (fieldName) { writeFields[fieldName] = userFields[fieldName]; });
  Object.keys(sourceFields).forEach(function (fieldName) { writeFields[fieldName] = sourceFields[fieldName]; });
  Object.keys(writeFields).forEach(function(fieldName) {
    if (idx[fieldName] !== undefined) {
      existingRow[idx[fieldName]] = writeFields[fieldName];
    }
  });

  // Apply audit
  var recordTimestamp = applyAuditFields(existingRow, idx, auth, resource.config, false);

  // Write back
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([existingRow]);
  updateResourceSyncCursor(resourceName, recordTimestamp);

  var savedRecord = rowArrayToObject(headers, existingRow);

  var directWriteResources = {};
  directWriteResources[resourceName] = buildDirectWriteResourcePayload(resourceName, resource.config, headers, [existingRow], auth, recordTimestamp);

  Object.keys(targetOutcome.resources).forEach(function (targetResourceName) {
    var written = targetOutcome.resources[targetResourceName];
    if (targetResourceName === resourceName) {
      directWriteResources[resourceName] = mergeWrittenRowsIntoResourcePayload(
        directWriteResources[resourceName], resource.config, headers, written.rows
      );
      return;
    }
    directWriteResources[targetResourceName] = buildDirectWriteResourcePayload(
      targetResourceName, written.config, written.headers, written.rows, auth
    );
  });

  var result = {
    success: true,
    message: actionName + ' completed successfully',
    data: mergeDeltaResourcesIntoResult(
      { code: code, column: column, columnValue: columnValue, targets: summarizeActionTargetResults(targetOutcome.results) },
      directWriteResources
    )
  };
  var sideEffectResources = [];
  if (resourceName === 'WarehouseTransfers') {
    sideEffectResources.push('WarehouseTransferItems', 'StockMovements', 'WarehouseStorages');
  }
  dispatchPostActionHook(resource.config, payload, result, auth, 'executeAction', {
    headers: headers,
    previousRecord: previousRecord,
    savedRecord: savedRecord,
    actionName: actionName
  }, resourceName);

  if (sideEffectResources.length) {
    var deltaPayloads = collectWriteDeltaResources(auth, payload, sideEffectResources);
    result.data = mergeDeltaResourcesIntoResult(result.data, deltaPayloads);
  }
  return result;
}

function handleResourceBulkUpsertRecords(auth, payload) {
  let targetResourceName = (payload.targetResource || '').toString().trim();
  if (!targetResourceName) {
    return { success: false, message: 'targetResource is required for bulk upload' };
  }

  let records = Array.isArray(payload.records) ? payload.records : [];
  if (!records.length) {
    return { success: false, message: 'No records provided' };
  }

  let resource = openResourceSheet(targetResourceName);
  let schema = buildMasterSchemaFromResourceConfig(resource.config);
  let sheet = resource.sheet;
  let headers = getSheetHeadersByMeta(resource.config.fileId, resource.config.sheetName, sheet);
  let idx = getHeaderIndexMap(headers);
  let codePrefix = (resource.config.codePrefix || '').toString().trim();
  let seqLength = resource.config.codeSequenceLength || 6;

  let maxColIdx = idx.Code !== undefined ? idx.Code : 0;
  (schema.uniqueHeaders || []).forEach(function (h) {
    if (idx[h] !== undefined && idx[h] > maxColIdx) maxColIdx = idx[h];
  });
  (schema.uniqueCompositeHeaders || []).forEach(function (combo) {
    (combo || []).forEach(function (h) {
      if (idx[h] !== undefined && idx[h] > maxColIdx) maxColIdx = idx[h];
    });
  });
  let maxNeededCol = Math.min(headers.length, maxColIdx + 1);
  if (maxNeededCol < 1) maxNeededCol = 1;

  let lastRow = sheet.getLastRow();
  const providedCodes = records.map(function(record) { return resolveCodeValue({ record: record }); }).filter(Boolean);
  if (providedCodes.length >= Math.max(2, Math.ceil((lastRow - 1) / 4))) maxNeededCol = headers.length;

  let currentValues;
  if (lastRow > 1) {
    currentValues = sheet.getRange(1, 1, lastRow, maxNeededCol).getValues();
  } else {
    currentValues = [headers.slice(0, maxNeededCol)];
  }

  const lookupValues = currentValues.slice();
  if (_activeBatchWritePlan && maxNeededCol < headers.length && providedCodes.length) {
    const rowNumbers = providedCodes.map(function(code) { return findRowByValue(sheet, idx.Code, code, 2, true, lookupValues); });
    getBatchSheetView(_activeBatchWritePlan, sheet, null, { rows: rowNumbers, width: headers.length });
  }
  const uniquenessIndex = {};
  let results = { created: 0, updated: 0, skipped: 0, errors: [] };
  let createdRecords = [];
  let updatedRecords = [];

  let newRows = [];       // Array of rowData arrays to append
  let updateOps = [];     // Array of {rowNumber, rowData} to write back
  let maxRecordTimestamp = 0;

  let seenCodesInBatch = {};
  let bulkBatchContext = { configs: {}, rows: {}, nameToCodeMap: null };

  records.forEach(function (recordData, index) {
    try {
      let code = resolveCodeValue({ record: recordData });
      let isDuplicateInBatch = code && !!seenCodesInBatch[code];
      if (code) seenCodesInBatch[code] = true;

      let rowNumber = (!isDuplicateInBatch && code) ? findRowByValue(sheet, idx.Code, code, 2, true, lookupValues) : -1;

      let providedValues = extractProvidedHeaderValues(headers, { record: recordData });
      let rowData;

      if (rowNumber === -1) {
        let newCode = code && !isDuplicateInBatch
          ? code
          : (resource.config.scope === 'operation'
            ? generateNextYearScopedCode(currentValues, idx, codePrefix, seqLength)
            : generateNextCode(currentValues, idx, codePrefix, seqLength));
        rowData = buildNewResourceRow(headers, idx, providedValues, schema);
        rowData[idx.Code] = newCode;
        applyAccessRegionOnWrite(rowData, idx, auth, resource.config, bulkBatchContext);
        let createdAtTs = applyAuditFields(rowData, idx, auth, resource.config, true);
        if (createdAtTs > maxRecordTimestamp) maxRecordTimestamp = createdAtTs;
        validateRequiredFields(rowData, idx, schema.requiredHeaders, targetResourceName);
        validateMasterUniqueness(currentValues, idx, rowData, schema, -1, targetResourceName, uniquenessIndex);

        newRows.push(rowData);
        currentValues.push(rowData);
        createdRecords.push(rowArrayToObject(headers, rowData));
        results.created++;
      } else {
        let existingRow = maxNeededCol === headers.length
          ? lookupValues[rowNumber - 1].slice()
          : sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
        enforceRecordLevelAccess(auth, resource.config, headers, existingRow);
        rowData = mergeMasterRow(existingRow, idx, providedValues, schema);
        rowData[idx.Code] = code;
        let updatedAtTs = applyAuditFields(rowData, idx, auth, resource.config, false);
        if (updatedAtTs > maxRecordTimestamp) maxRecordTimestamp = updatedAtTs;
        validateRequiredFields(rowData, idx, schema.requiredHeaders, targetResourceName);
        validateMasterUniqueness(currentValues, idx, rowData, schema, rowNumber, targetResourceName, uniquenessIndex);

        updateOps.push({ rowNumber: rowNumber, rowData: rowData });
        currentValues[rowNumber - 1] = rowData;
        uniquenessIndex.changedRows.push(rowNumber - 1);
        updatedRecords.push(rowArrayToObject(headers, rowData));
        results.updated++;
      }
    } catch (err) {
      results.errors.push({ index: index, message: err.toString() });
    }
  });

  // Batch write: new rows as a single block append
  if (newRows.length) {
    let startRow = lastRow + 1;
    sheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
  }

  // Batch write: updates (individual rows — scattered positions prevent single setValues)
  for (let u = 0; u < updateOps.length; u++) {
    sheet.getRange(updateOps[u].rowNumber, 1, 1, headers.length).setValues([updateOps[u].rowData]);
  }

  updateResourceSyncCursor(targetResourceName, maxRecordTimestamp);
  let allFailed = results.errors.length >= records.length;
  let hasErrors = results.errors.length > 0;
  let bulkMessage = buildBulkUpsertResultMessage(targetResourceName, results, records.length);

  let allRows = newRows.concat(updateOps.map(function (op) { return op.rowData; }));
  let directPayload = buildDirectWriteResourcePayload(targetResourceName, resource.config, headers, allRows, auth, maxRecordTimestamp);
  let directResources = {};
  directResources[targetResourceName] = directPayload;

  let result = {
    success: !allFailed,
    message: bulkMessage,
    error: hasErrors ? bulkMessage : null,
    data: mergeDeltaResourcesIntoResult(
      {
        created: results.created,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors
      },
      directResources
    )
  };
  let sideEffectResources = [];
  if (targetResourceName === 'OutletMovements') {
    sideEffectResources.push('OutletStorages');
  } else if (targetResourceName === 'StockMovements') {
    sideEffectResources.push('WarehouseStorages');
  }
  dispatchPostActionHook(resource.config, payload, result, auth, 'bulk', {
    headers: headers,
    targetResource: targetResourceName,
    createdRecords: createdRecords,
    updatedRecords: updatedRecords,
    savedRecords: createdRecords.concat(updatedRecords),
    summary: {
      created: results.created,
      updated: results.updated,
      skipped: results.skipped,
      errors: results.errors
    }
  }, targetResourceName);

  if (sideEffectResources.length) {
    let deltaPayloads = collectWriteDeltaResources(auth, payload, sideEffectResources);
    result.data = mergeDeltaResourcesIntoResult(result.data, deltaPayloads);
  }
  return result;
}

function buildBulkUpsertResultMessage(resourceName, results, totalRecords) {
  var created = Number(results && results.created) || 0;
  var updated = Number(results && results.updated) || 0;
  var skipped = Number(results && results.skipped) || 0;
  var errors = results && Array.isArray(results.errors) ? results.errors : [];
  var total = Number(totalRecords) || 0;

  if (errors.length >= total && total > 0) {
    return resourceName + ' bulk upload failed: 0 of ' + total + ' records processed. First error: ' + formatBulkErrorMessage(errors[0]);
  }

  if (errors.length > 0) {
    return resourceName + ' bulk upload partially completed: ' + created + ' created, ' + updated + ' updated, ' + skipped + ' skipped, ' + errors.length + ' failed. First error: ' + formatBulkErrorMessage(errors[0]);
  }

  return resourceName + ' bulk upload completed: ' + created + ' created, ' + updated + ' updated, ' + skipped + ' skipped.';
}

function formatBulkErrorMessage(errorEntry) {
  if (!errorEntry) return 'Unknown error';
  var rowNumber = Number(errorEntry.index) + 1;
  var message = (errorEntry.message || '').toString().trim() || 'Unknown error';
  message = message.replace(/^Error:\s*/i, '');
  return 'row ' + rowNumber + ': ' + message;
}
