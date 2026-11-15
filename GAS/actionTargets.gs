function findAdditionalActionConfig(resourceConfig, actionName) {
  var actions = resourceConfig && Array.isArray(resourceConfig.additionalActions)
    ? resourceConfig.additionalActions
    : [];
  var wanted = (actionName || '').toString().trim().toLowerCase();
  if (!wanted) return null;

  for (var i = 0; i < actions.length; i++) {
    var entry = actions[i];
    var name = (entry && entry.action ? entry.action : '').toString().trim().toLowerCase();
    if (name && name === wanted) return entry;
  }
  return null;
}

function resolveActionTargetKey(target, index) {
  var key = (target && target.key ? target.key : '').toString().trim();
  return key || String(index);
}

function resolveActionExpression(expression, ctx) {
  if (expression === undefined || expression === null) return '';
  if (typeof expression !== 'string') return expression;

  if (/\$\{[^}]*\}/.test(expression)) {
    return expression.replace(/\$\{([^}]*)\}/g, function (match, inner) {
      var value = resolveActionExpression(String(inner).trim(), ctx);
      return value === undefined || value === null ? '' : String(value);
    });
  }

  var expr = expression.trim();
  if (!expr || expr.charAt(0) !== '$') return expression;
  if (expr.indexOf('$$') === 0) return expr.slice(1);

  var dot = expr.indexOf('.');
  var head = dot === -1 ? expr : expr.slice(0, dot);
  var tail = dot === -1 ? '' : expr.slice(dot + 1);

  if (head === '$record') return readActionRecordValue(ctx, tail);
  if (head === '$field') return readActionFieldValue(ctx, tail);
  if (head === '$target') return readActionTargetValue(ctx, tail);

  return resolveActionToken(expr, ctx);
}

function readActionRecordValue(ctx, column) {
  var name = (column || '').toString().trim();
  if (!name) throw new Error('Action expression "$record" requires a column, e.g. $record.OutletCode');
  var record = (ctx && ctx.record) || {};
  return record[name] === undefined ? '' : record[name];
}

function readActionFieldValue(ctx, name) {
  var key = (name || '').toString().trim();
  if (!key) throw new Error('Action expression "$field" requires a field name, e.g. $field.Comment');

  var fields = (ctx && ctx.fields) || {};
  if (fields[key] !== undefined) return fields[key];

  var derived = (ctx.column || '') + (ctx.stampSuffix || '') + key;
  if (fields[derived] !== undefined) return fields[derived];

  return '';
}

function readActionTargetValue(ctx, path) {
  var parts = (path || '').toString().split('.');
  var key = (parts.shift() || '').trim();
  var column = parts.join('.').trim();

  if (!key || !column) {
    throw new Error('Action expression "$target" requires a key and a column, e.g. $target.newVisit.Code');
  }

  var resolved = (ctx && ctx.targets) || {};
  if (resolved[key] === undefined) {
    var skipped = (ctx && ctx.skippedTargets) || {};
    if (skipped[key]) {
      throw new Error(
        'Action expression "$target.' + key + '" refers to target "' + key + '", which was SKIPPED ' +
        'by its "when" condition on this run, so it produced no record. A target that other targets ' +
        'or fields read from must not be conditional — remove its "when", or drop the dependency.'
      );
    }
    throw new Error('Action expression "$target.' + key + '" refers to a target that has not run yet');
  }

  var record = resolved[key].record || {};
  return record[column] === undefined ? '' : record[column];
}

function resolveActionToken(expr, ctx) {
  var parts = (expr || '').toString().split(':');
  var token = parts[0];
  var param = parts.length > 1 ? parts[1] : '';
  var key = token.toLowerCase();

  var auth = (ctx && ctx.auth) || {};
  var user = auth.user || {};

  switch (key) {
    case '$usercode': return user.UserID || '';
    case '$username': return user.Name || user.UserID || '';
    case '$useremail': return user.Email || '';
    case '$userrole': return resolveActionUserRole(user);
    case '$userdesignation': return resolveActionUserDesignation(user);
    case '$userregion': return resolveActionUserRegion(auth);
    case '$now': return Date.now();
    case '$datetime': return formatDateTime24();
    case '$today': return actionDateOnly(0);
    case '$date': return actionDateOnly(Number(param) || 0);
    default:
      throw new Error('Unknown action expression token: ' + token);
  }
}

function resolveActionUserRole(user) {
  try {
    return getPrimaryRoleName(user) || '';
  } catch (e) {
    return '';
  }
}

function resolveActionUserDesignation(user) {
  try {
    var designation = getDesignationById(user.DesignationID);
    return (designation && designation.name) ? designation.name : '';
  } catch (e) {
    return '';
  }
}

function resolveActionUserRegion(auth) {
  try {
    var scope = auth.accessRegionScope || buildUserAccessRegionScope(auth.user);
    return (scope && scope.assignedCode) ? scope.assignedCode : '';
  } catch (e) {
    return '';
  }
}

function actionDateOnly(offsetDays) {
  var date = new Date();
  date.setDate(date.getDate() + (Number(offsetDays) || 0));
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

var ACTION_TARGET_CONDITION_OPS = ['eq', 'ne', 'in', 'nin', 'empty', 'notEmpty'];

function isActionTargetConditionOp(op) {
  return ACTION_TARGET_CONDITION_OPS.indexOf((op === undefined || op === null) ? '' : op.toString()) !== -1;
}

function hasActionConditionOperand(value) {
  return value !== undefined && value !== null && value.toString().trim() !== '';
}

function actionConditionText(value) {
  return (value === undefined || value === null) ? '' : String(value);
}

function actionConditionList(value) {
  var arr = Array.isArray(value) ? value : [value];
  return arr.map(function (item) { return String(item); });
}

// Mirrors evalCondition / isTargetActive on the client.
function evaluateActionTargetCondition(condition, targetKey, ctx) {
  if (!condition || typeof condition !== 'object') return null;
  if (!isActionTargetConditionOp(condition.op)) return null;

  var cell;
  if (hasActionConditionOperand(condition.field)) {
    var submitted = (ctx && ctx.targetFields && ctx.targetFields[targetKey]) || {};
    cell = submitted[condition.field.toString().trim()];
  } else if (hasActionConditionOperand(condition.column)) {
    var record = (ctx && ctx.record) || {};
    cell = record[condition.column.toString().trim()];
  } else if (hasActionConditionOperand(condition.expression)) {
    cell = resolveActionExpression(condition.expression, ctx);
  } else {
    return null;
  }

  var isEmpty = (cell === undefined || cell === null || cell === '');
  var text = actionConditionText(cell);

  switch (condition.op) {
    case 'eq': return text === actionConditionText(condition.value);
    case 'ne': return text !== actionConditionText(condition.value);
    case 'in': return actionConditionList(condition.value).indexOf(text) !== -1;
    case 'nin': return actionConditionList(condition.value).indexOf(text) === -1;
    case 'empty': return isEmpty;
    case 'notEmpty': return !isEmpty;
    default: return null;
  }
}

function isActionTargetActive(target, targetKey, ctx) {
  if (!target || target.when === undefined || target.when === null) return true;

  var list = Array.isArray(target.when) ? target.when : [target.when];
  for (var i = 0; i < list.length; i++) {
    if (evaluateActionTargetCondition(list[i], targetKey, ctx) === false) return false;
  }
  return true;
}

function getActionSheetContext(cache, resourceName) {
  var name = (resourceName || '').toString().trim();
  if (!name) throw new Error('Action target is missing a resource name');
  if (cache[name]) return cache[name];

  var resource = openResourceSheet(name);
  var headers = getSheetHeadersByMeta(resource.config.fileId, resource.config.sheetName, resource.sheet);
  var lastRow = resource.sheet.getLastRow();
  var values = lastRow > 1
    ? resource.sheet.getRange(1, 1, lastRow, headers.length).getValues()
    : [headers];

  cache[name] = {
    resourceName: name,
    config: resource.config,
    sheet: resource.sheet,
    values: values,
    headers: headers,
    idx: getHeaderIndexMap(headers),
    schema: buildMasterSchemaFromResourceConfig(resource.config),
    uniquenessIndex: {},
    appendRows: [],
    updateRows: [],
    writtenRows: [],
    maxTimestamp: 0
  };
  return cache[name];
}

function buildActionTargetRecord(target, targetKey, ctx) {
  var fields = Array.isArray(target.fields) ? target.fields : [];
  var submitted = (ctx.targetFields && ctx.targetFields[targetKey]) || {};
  var record = {};

  fields.forEach(function (field) {
    var name = (field && field.name ? field.name : '').toString().trim();
    if (!name) return;

    var isUserFacing = !!(field.type && field.type.toString().trim());
    var userValue = submitted[name];
    var hasUserValue = isUserFacing && userValue !== undefined && userValue !== null && userValue !== '';

    if (hasUserValue) {
      record[name] = userValue;
      return;
    }

    if (field.from !== undefined) {
      record[name] = resolveActionExpression(field.from, ctx);
      return;
    }

    if (field.value !== undefined) {
      record[name] = resolveActionExpression(field.value, ctx);
      return;
    }

    if (isUserFacing) record[name] = '';
  });

  return record;
}

function deriveActionSourceHeader(name, column, stampSuffix, idx) {
  if (!name) return null;
  var derived = column + stampSuffix + name;
  if (idx[derived] !== undefined) return derived;
  if (idx[name] !== undefined) return name;
  return null;
}

function buildActionSourceFields(actionConfig, ctx) {
  var fields = (actionConfig && Array.isArray(actionConfig.fields)) ? actionConfig.fields : [];
  var submitted = (ctx && ctx.fields) || {};
  var record = {};

  fields.forEach(function (field) {
    var name = (field && field.name ? field.name : '').toString().trim();
    if (!name) return;

    var header = deriveActionSourceHeader(name, ctx.column, ctx.stampSuffix, ctx.idx);
    if (!header) return;

    var isUserFacing = !!(field.type && field.type.toString().trim());
    if (isUserFacing) {
      if (submitted[header] !== undefined) record[header] = submitted[header];
      else if (submitted[name] !== undefined) record[header] = submitted[name];
      else if (field.from !== undefined) record[header] = resolveActionExpression(field.from, ctx);
      else if (field.value !== undefined) record[header] = resolveActionExpression(field.value, ctx);
      return;
    }

    if (field.from !== undefined) record[header] = resolveActionExpression(field.from, ctx);
    else if (field.value !== undefined) record[header] = resolveActionExpression(field.value, ctx);
  });

  return record;
}

function validateActionTargetFields(target, targetKey, record) {
  var fields = Array.isArray(target.fields) ? target.fields : [];
  var label = (target.label || target.resource || targetKey || 'Target').toString();

  fields.forEach(function (field) {
    var name = (field && field.name ? field.name : '').toString().trim();
    if (!name || !field.required) return;
    if (!field.type || !field.type.toString().trim()) return;

    var value = record[name];
    if (value === undefined || value === null || value.toString().trim() === '') {
      throw new Error(label + ': ' + (field.label || name) + ' is required');
    }
  });
}

function prepareActionTarget(auth, target, targetKey, ctx, cache) {
  var resourceName = (target.resource || '').toString().trim();
  if (!resourceName) throw new Error('Action target "' + targetKey + '" is missing a resource');

  var mode = (target.mode || '').toString().trim().toLowerCase();
  if (mode !== 'create' && mode !== 'update') {
    throw new Error('Action target "' + targetKey + '" needs mode "create" or "update"');
  }

  var sheetCtx = getActionSheetContext(cache, resourceName);
  var record = buildActionTargetRecord(target, targetKey, ctx);
  validateActionTargetFields(target, targetKey, record);

  var providedValues = extractProvidedHeaderValues(sheetCtx.headers, { record: record });

  return mode === 'create'
    ? prepareActionTargetCreate(auth, target, targetKey, sheetCtx, providedValues)
    : prepareActionTargetUpdate(auth, target, targetKey, ctx, sheetCtx, providedValues);
}

function prepareActionTargetCreate(auth, target, targetKey, sheetCtx, providedValues) {
  let config = sheetCtx.config;
  let idx = sheetCtx.idx;

  let code = (providedValues.Code || '').toString().trim();
  if (!code) {
    let codePrefix = (config.codePrefix || '').toString().trim();
    if (!codePrefix) {
      throw new Error('CodePrefix is missing for resource: ' + sheetCtx.resourceName);
    }
    let seqLength = config.codeSequenceLength || 6;
    code = config.scope === 'operation'
      ? generateNextYearScopedCode(sheetCtx.values, idx, codePrefix, seqLength)
      : generateNextCode(sheetCtx.values, idx, codePrefix, seqLength);
  }

  let rowData = buildNewResourceRow(sheetCtx.headers, idx, providedValues, sheetCtx.schema);
  rowData[idx.Code] = code;

  applyAccessRegionOnWrite(rowData, idx, auth, config);
  let createTimestamp = applyAuditFields(rowData, idx, auth, config, true);
  if (createTimestamp > sheetCtx.maxTimestamp) sheetCtx.maxTimestamp = createTimestamp;
  validateRequiredFields(rowData, idx, sheetCtx.schema.requiredHeaders, sheetCtx.resourceName);
  validateMasterUniqueness(sheetCtx.values, idx, rowData, sheetCtx.schema, -1, sheetCtx.resourceName, sheetCtx.uniquenessIndex);

  sheetCtx.values.push(rowData);
  _row_lookup_cache.delete(sheetCtx.values);
  sheetCtx.appendRows.push(rowData);

  return {
    key: targetKey,
    mode: 'create',
    resourceName: sheetCtx.resourceName,
    code: code,
    row: rowData,
    record: rowArrayToObject(sheetCtx.headers, rowData)
  };
}

function prepareActionTargetUpdate(auth, target, targetKey, ctx, sheetCtx, providedValues) {
  let code = resolveActionExpression(target.code, ctx);
  code = (code === undefined || code === null) ? '' : code.toString().trim();
  if (!code) {
    throw new Error('Action target "' + targetKey + '" is mode "update" but resolved an empty code');
  }

  let idx = sheetCtx.idx;
  let rowNumber = findRowByValue(sheetCtx.sheet, idx.Code, code, 2, true, sheetCtx.values);
  if (rowNumber === -1) {
    throw new Error(sheetCtx.resourceName + ' record not found: ' + code);
  }

  let existingRow = sheetCtx.values[rowNumber - 1].slice();
  enforceRecordLevelAccess(auth, sheetCtx.config, sheetCtx.headers, existingRow);

  let rowData = mergeMasterRow(existingRow, idx, providedValues, sheetCtx.schema);
  let updateTimestamp = applyAuditFields(rowData, idx, auth, sheetCtx.config, false);
  if (updateTimestamp > sheetCtx.maxTimestamp) sheetCtx.maxTimestamp = updateTimestamp;
  validateRequiredFields(rowData, idx, sheetCtx.schema.requiredHeaders, sheetCtx.resourceName);
  validateMasterUniqueness(sheetCtx.values, idx, rowData, sheetCtx.schema, rowNumber, sheetCtx.resourceName, sheetCtx.uniquenessIndex);

  sheetCtx.values[rowNumber - 1] = rowData;
  if (sheetCtx.uniquenessIndex.changedRows) {
    sheetCtx.uniquenessIndex.changedRows.push(rowNumber - 1);
  }
  if (rowData[idx.Code] !== existingRow[idx.Code]) {
    _row_lookup_cache.delete(sheetCtx.values);
    _code_sequence_cache.delete(sheetCtx.values);
  }
  const appendIndex = rowNumber - 1 - (sheetCtx.values.length - sheetCtx.appendRows.length);
  if (appendIndex >= 0) sheetCtx.appendRows[appendIndex] = rowData;
  else sheetCtx.updateRows.push({ rowNumber: rowNumber, row: rowData });

  return {
    key: targetKey,
    mode: 'update',
    resourceName: sheetCtx.resourceName,
    code: code,
    rowNumber: rowNumber,
    row: rowData,
    record: rowArrayToObject(sheetCtx.headers, rowData)
  };
}

function executeActionTargets(auth, targets, ctx) {
  var list = Array.isArray(targets) ? targets : [];
  if (!list.length) return { resources: {}, results: [] };

  var cache = {};
  var results = [];

  ctx.targets = ctx.targets || {};
  ctx.skippedTargets = ctx.skippedTargets || {};
  for (var i = 0; i < list.length; i++) {
    var target = list[i];
    var key = resolveActionTargetKey(target, i);

    if (!isActionTargetActive(target, key, ctx)) {
      ctx.skippedTargets[key] = true;
      results.push({
        key: key,
        mode: (target && target.mode ? target.mode : 'create').toString().trim().toLowerCase(),
        resourceName: (target && target.resource ? target.resource : '').toString().trim(),
        skipped: true
      });
      continue;
    }

    var prepared = prepareActionTarget(auth, target, key, ctx, cache);
    results.push(prepared);
    ctx.targets[key] = { code: prepared.code, record: prepared.record };
  }

  var resources = {};
  Object.keys(cache).forEach(function (resourceName) {
    var sheetCtx = cache[resourceName];
    var width = sheetCtx.headers.length;

    sheetCtx.updateRows.forEach(function (entry) {
      sheetCtx.sheet.getRange(entry.rowNumber, 1, 1, width).setValues([entry.row]);
      sheetCtx.writtenRows.push(entry.row);
    });

    if (sheetCtx.appendRows.length) {
      var startRow = sheetCtx.sheet.getLastRow() + 1;
      sheetCtx.sheet.getRange(startRow, 1, sheetCtx.appendRows.length, width).setValues(sheetCtx.appendRows);
      sheetCtx.appendRows.forEach(function (row) { sheetCtx.writtenRows.push(row); });
    }

    updateResourceSyncCursor(resourceName, sheetCtx.maxTimestamp);
    resources[resourceName] = {
      config: sheetCtx.config,
      headers: sheetCtx.headers,
      rows: sheetCtx.writtenRows
    };
  });

  return { resources: resources, results: results };
}

function summarizeActionTargetResults(results) {
  return (Array.isArray(results) ? results : []).map(function (entry) {
    if (entry && entry.skipped) {
      return {
        key: entry.key,
        mode: entry.mode,
        resource: entry.resourceName,
        skipped: true
      };
    }
    return {
      key: entry.key,
      mode: entry.mode,
      resource: entry.resourceName,
      code: entry.code
    };
  });
}
