// PostAction = handleStockMovementsBulkSave. Keeps WarehouseStorages in step with the StockMovements ledger.

function handleStockMovementsBulkSave_afterBulk(payload, result, auth, action, meta, resourceName) {
  try {
    let records = meta && Array.isArray(meta.savedRecords)
      ? meta.savedRecords
      : (payload && Array.isArray(payload.records) ? payload.records : []);
    applyBatchStockMovementsToWarehouseStorages(records.map(toStorageMovement), auth);
  } catch (e) {
    if (_activeBatchWritePlan && _activeBatchWritePlan.strict) {
      _activeBatchWritePlan.failure = e;
      throw e;
    }
    Logger.log('handleStockMovementsBulkSave_afterBulk ERROR: ' + String(e));
  }
}

function handleStockMovementsBulkSave_afterCreate(payload, result, auth, action, meta, resourceName) {
  try {
    let record = meta && meta.savedRecord ? meta.savedRecord : null;
    if (record) applyStockMovementToWarehouseStorages(record, auth);
  } catch (e) {
    if (_activeBatchWritePlan && _activeBatchWritePlan.strict) {
      _activeBatchWritePlan.failure = e;
      throw e;
    }
    Logger.log('handleStockMovementsBulkSave_afterCreate ERROR: ' + String(e));
  }
}

function toStorageMovement(rec) {
  return { warehouseCode: rec.WarehouseCode, storageName: rec.StorageName, sku: rec.SKU, qtyChange: rec.QtyChange };
}

function applyStockMovementToWarehouseStorages(record, auth) {
  try {
    if (!record) return { success: true, skipped: true };
    applyBatchStockMovementsToWarehouseStorages([toStorageMovement(record)], auth);
    return { success: true };
  } catch (e) {
    if (_activeBatchWritePlan && _activeBatchWritePlan.strict) {
      _activeBatchWritePlan.failure = e;
      throw e;
    }
    Logger.log('applyStockMovementToWarehouseStorages ERROR: ' + String(e) + ' | record=' + JSON.stringify(record));
    return { success: false, error: String(e) };
  }
}

// Zero and negative balances are kept as rows so delta reads carry them to the app.
function applyBatchStockMovementsToWarehouseStorages(records, auth) {
  let aggregates = {};
  (records || []).forEach(function (rec) {
    if (!rec) return;
    let warehouseCode = (rec.warehouseCode || '').toString().trim();
    let storageName = (rec.storageName || '').toString().trim();
    let sku = (rec.sku || '').toString().trim();
    let qtyChange = Number(rec.qtyChange);
    if (!warehouseCode || !storageName || !sku || !Number.isFinite(qtyChange) || qtyChange === 0) return;
    let key = warehouseCode + '|' + storageName + '|' + sku;
    if (!aggregates[key]) aggregates[key] = { warehouseCode: warehouseCode, storageName: storageName, sku: sku, qtyChange: 0 };
    aggregates[key].qtyChange += qtyChange;
  });

  let keys = Object.keys(aggregates);
  if (!keys.length) return;

  let resource = openResourceSheet('WarehouseStorages');
  let sheet = resource.sheet;
  let config = resource.config;
  let headers = getSheetHeadersByMeta(config.fileId, config.sheetName, sheet);
  let lastRow = sheet.getLastRow();
  let values = lastRow > 1 ? sheet.getRange(1, 1, lastRow, headers.length).getValues() : [headers];
  let idx = getHeaderIndexMap(headers);
  let updatedRows = {};
  let newRows = [];
  const codeValues = values.slice();
  const rowByKey = new Map();
  for (let i = 1; i < values.length; i++) {
    const key = JSON.stringify([
      (values[i][idx.WarehouseCode] || '').toString().trim(),
      (values[i][idx.StorageName] || '').toString().trim(), (values[i][idx.SKU] || '').toString().trim()
    ]);
    if (!rowByKey.has(key)) rowByKey.set(key, i);
  }
  let batchContext = { configs: {}, rows: {}, nameToCodeMap: null };
  let now = Date.now();
  let userId = auth && auth.user ? (auth.user.UserID || '') : '';

  keys.forEach(function (key) {
    let entry = aggregates[key];
    if (!entry.qtyChange) return;
    const rowKey = JSON.stringify([entry.warehouseCode, entry.storageName, entry.sku]);
    const matchedIndex = rowByKey.has(rowKey) ? rowByKey.get(rowKey) : -1;
    if (matchedIndex !== -1) {
      let existing = values[matchedIndex].slice();
      let nextQty = Number(existing[idx.Quantity] || 0) + entry.qtyChange;
      existing[idx.Quantity] = nextQty;
      if (idx.UpdatedAt !== undefined) existing[idx.UpdatedAt] = now;
      if (idx.Revision !== undefined) {
        let curRev = Number(existing[idx.Revision]);
        existing[idx.Revision] = (!curRev || isNaN(curRev) || curRev < 0) ? 1 : curRev + 1;
      }
      if (idx.UpdatedBy !== undefined) existing[idx.UpdatedBy] = userId;
      updatedRows[matchedIndex] = existing;
    } else {
      let newRow = new Array(headers.length).fill('');
      if (idx.Code !== undefined) {
        newRow[idx.Code] = generateNextCode(
          codeValues, idx, (config.codePrefix || 'LOC').toString().trim(), config.codeSequenceLength || 5
        );
      }
      if (idx.WarehouseCode !== undefined) newRow[idx.WarehouseCode] = entry.warehouseCode;
      if (idx.StorageName !== undefined) newRow[idx.StorageName] = entry.storageName;
      if (idx.SKU !== undefined) newRow[idx.SKU] = entry.sku;
      if (idx.Quantity !== undefined) newRow[idx.Quantity] = entry.qtyChange;
      applyAccessRegionOnWrite(newRow, idx, auth, config, batchContext);
      applyAuditFields(newRow, idx, auth, config, true);
      if (idx.UpdatedAt !== undefined) newRow[idx.UpdatedAt] = now;
      if (idx.Revision !== undefined) newRow[idx.Revision] = 1;
      newRows.push(newRow);
      codeValues.push(newRow);
    }
  });

  const writtenRows = Object.keys(updatedRows).map(function (rowIndexText) {
    let rowIndex = parseInt(rowIndexText, 10);
    sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([updatedRows[rowIndex]]);
    return updatedRows[rowIndex];
  }).concat(newRows);
  if (newRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);

  if (writtenRows.length) {
    updateResourceSyncCursor('WarehouseStorages', now);
  }
}
