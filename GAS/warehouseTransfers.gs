// PARENT AFTER-COMPOSITE-SAVE HOOK

function handleWarehouseTransfers_afterCompositeSave(payload, result, auth, action, meta, resourceName) {
  // All initial save stock movements and transitions are managed by the frontend composable
  return result;
}

// PARENT AFTER-EXECUTE-ACTION HOOK

function handleWarehouseTransfers_afterExecuteAction(payload, result, auth, action, meta, resourceName) {
  try {
    if (!result || result.success !== true) return result;

    let parentRecord = meta.savedRecord;
    let actionName = meta.actionName;
    if (!parentRecord || !actionName) return result;

    let wtCode = parentRecord.Code;
    let items = getWarehouseTransferItems(wtCode);

    if (actionName === 'Reject') {
      // 1. Return/reverse stock to Source Warehouse
      let returnMovements = [];
      for (let i = 0; i < items.length; i++) {
        let item = items[i];
        if (item.Progress !== 'CANCELLED') {
          returnMovements.push({
            WarehouseCode: parentRecord.SourceWarehouseCode,
            StorageName: item.SourceStorageName || '_default',
            SKU: item.SKUCode,
            QtyChange: Math.abs(Number(item.Quantity)),
            ReferenceType: 'WarehouseTransfer',
            ReferenceCode: wtCode
          });
        }
      }

      // Update items to CANCELLED
      updateWarehouseTransferItemsProgress(items, 'CANCELLED', auth);

      if (returnMovements.length > 0) {
        writeStockMovements(returnMovements, auth);
      }
    }
    else if (actionName === 'Complete' || actionName === 'ClaimAndComplete') {
      let destWH = parentRecord.DestinationWarehouseCode;
      if (!destWH) {
        Logger.log('handleWarehouseTransfers_afterExecuteAction: DestinationWarehouseCode must be set for completion.');
        return result;
      }

      let completeMovements = [];
      let itemsToUpdate = [];

      for (let j = 0; j < items.length; j++) {
        let itemToComplete = items[j];
        if (itemToComplete.Progress === 'PENDING') {
          let destStorage = itemToComplete.DestinationStorageName || '_default';
          completeMovements.push({
            WarehouseCode: destWH,
            StorageName: destStorage,
            SKU: itemToComplete.SKUCode,
            QtyChange: Math.abs(Number(itemToComplete.Quantity)),
            ReferenceType: 'WarehouseTransfer',
            ReferenceCode: wtCode
          });
          itemsToUpdate.push(itemToComplete);
        }
      }

      // Update items to TRANSFERRED
      updateWarehouseTransferItemsProgress(itemsToUpdate, 'TRANSFERRED', auth);

      if (completeMovements.length > 0) {
        writeStockMovements(completeMovements, auth);
      }
    }

  } catch (e) {
    if (_activeBatchWritePlan && _activeBatchWritePlan.strict) {
      _activeBatchWritePlan.failure = e;
      throw e;
    }
    Logger.log('handleWarehouseTransfers_afterExecuteAction ERROR: ' + String(e));
  }
  return result;
}

// CHILD ITEM AFTER-UPDATE HOOK (Item-by-item completion support)

function handleWarehouseTransferItems_afterUpdate(payload, result, auth, action, meta, resourceName) {
  try {
    if (!result || result.success !== true) return result;

    let prevRecord = meta.previousRecord;
    let savedRecord = meta.savedRecord;
    if (!prevRecord || !savedRecord) return result;

    // Check if progress transitioned from PENDING to TRANSFERRED
    if (prevRecord.Progress !== 'TRANSFERRED' && savedRecord.Progress === 'TRANSFERRED') {
      let wtCode = savedRecord.WarehouseTransferCode;

      // Get destination warehouse code from parent record
      let parentContext = getResourceRecordContextByCode('WarehouseTransfers', wtCode);
      if (!parentContext) return result;

      let parentObj = rowArrayToObject(parentContext.headers, parentContext.rowData);
      let destWH = parentObj.DestinationWarehouseCode;

      if (!destWH) {
        Logger.log('handleWarehouseTransferItems_afterUpdate ERROR: DestinationWarehouseCode is not set on parent WT ' + wtCode);
        return result;
      }

      // Write positive stock movement for this completed item
      let movement = {
        WarehouseCode: destWH,
        StorageName: savedRecord.DestinationStorageName || '_default',
        SKU: savedRecord.SKUCode,
        QtyChange: Math.abs(Number(savedRecord.Quantity)),
        ReferenceType: 'WarehouseTransfer',
        ReferenceCode: wtCode
      };

      writeStockMovements([movement], auth);

      // Check if all items for the parent are now TRANSFERRED or CANCELLED
      let siblingItems = getWarehouseTransferItems(wtCode);
      let allCompleted = siblingItems.every(function(item) {
        return item.Progress === 'TRANSFERRED' || item.Progress === 'CANCELLED';
      });

      if (allCompleted) {
        updateWarehouseTransferProgress(wtCode, 'COMPLETED', auth, null, parentContext);
      }
    }

  } catch (e) {
    if (_activeBatchWritePlan && _activeBatchWritePlan.strict) {
      _activeBatchWritePlan.failure = e;
      throw e;
    }
    Logger.log('handleWarehouseTransferItems_afterUpdate ERROR: ' + String(e));
  }
  return result;
}

// GENERAL INTERNAL HELPERS

function writeStockMovements(movements, auth) {
  if (!movements || movements.length === 0) return;

  let resource = openResourceSheet('StockMovements');
  let sheet = resource.sheet;
  let headers = getSheetHeadersByMeta(resource.config.fileId, resource.config.sheetName, sheet);
  let idx = getHeaderIndexMap(headers);
  let lastRow = sheet.getLastRow();
  let codeColWidth = Math.min(headers.length, (idx.Code !== undefined ? idx.Code : 0) + 1);
  if (codeColWidth < 1) codeColWidth = 1;
  let values = lastRow > 1
    ? sheet.getRange(1, 1, lastRow, codeColWidth).getValues()
    : [headers.slice(0, codeColWidth)];

  let codePrefix = (resource.config.codePrefix || 'SM').toString().trim();
  let codeSeqLength = resource.config.codeSequenceLength || 6;

  let rowsToWrite = [];
  const codeValues = values.slice();
  let batchContext = { configs: {}, rows: {}, nameToCodeMap: null };
  // Newest audit timestamp across the batch; drives the StockMovements cursor.
  let maxMovementTimestamp = 0;
  for (let i = 0; i < movements.length; i++) {
    let mov = movements[i];
    let row = new Array(headers.length).fill('');

    // Generate code using values already in sheet + rows generated in this loop
    row[idx.Code] = generateNextCode(codeValues, idx, codePrefix, codeSeqLength);
    row[idx.WarehouseCode] = mov.WarehouseCode;
    row[idx.StorageName] = mov.StorageName || '_default';
    row[idx.SKU] = mov.SKU;
    row[idx.QtyChange] = mov.QtyChange;
    row[idx.ReferenceType] = mov.ReferenceType;
    row[idx.ReferenceCode] = mov.ReferenceCode;
    row[idx.Status] = 'Active';

    applyAccessRegionOnWrite(row, idx, auth, resource.config, batchContext);
    let movementTimestamp = applyAuditFields(row, idx, auth, resource.config, true);
    if (movementTimestamp > maxMovementTimestamp) maxMovementTimestamp = movementTimestamp;
    rowsToWrite.push(row);
    codeValues.push(row);
  }

  sheet.getRange(lastRow + 1, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
  if (!_activeBatchWritePlan) SpreadsheetApp.flush();
  updateResourceSyncCursor('StockMovements', maxMovementTimestamp);

  // Trigger warehouse storage balance updates
  let storageRecords = movements.map(function(mov) {
    return {
      warehouseCode: mov.WarehouseCode,
      storageName: mov.StorageName || '_default',
      sku: mov.SKU,
      qtyChange: mov.QtyChange
    };
  });

  applyBatchStockMovementsToWarehouseStorages(storageRecords, auth);
}

function getWarehouseTransferItems(wtCode) {
  var resource = openResourceSheet('WarehouseTransferItems');
  var sheet = resource.sheet;
  var headers = getSheetHeadersByMeta(resource.config.fileId, resource.config.sheetName, sheet);
  var idx = getHeaderIndexMap(headers);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var values = sheet.getRange(1, 1, lastRow, headers.length).getValues();

  var items = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if ((row[idx.WarehouseTransferCode] || '').toString().trim() === wtCode &&
        (row[idx.Status] || '').toString().trim() === 'Active') {
      var item = rowArrayToObject(headers, row);
      item._rowNumber = i + 1;
      item._rowData = row.slice();
      items.push(item);
    }
  }
  return items;
}

function updateWarehouseTransferItemsProgress(items, progress, auth, storageField, storageValue) {
  if (!items || items.length === 0) return;

  let resource = openResourceSheet('WarehouseTransferItems');
  let sheet = resource.sheet;
  const headers = getSheetHeadersByMeta(resource.config.fileId, resource.config.sheetName, sheet);
  let idx = getHeaderIndexMap(headers);
  const missingRowNumbers = items
    .filter(function(item) { return item && item._rowNumber && !Array.isArray(item._rowData); })
    .map(function(item) { return item._rowNumber; });
  if (_activeBatchWritePlan && missingRowNumbers.length) {
    getBatchSheetView(_activeBatchWritePlan, sheet, null, { rows: missingRowNumbers, width: headers.length });
  }
  let maxItemTimestamp = 0;
  let writtenRows = [];

  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    let rowNumber = item._rowNumber;
    if (!rowNumber) continue;

    let rowData = Array.isArray(item._rowData)
      ? item._rowData.slice()
      : sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    rowData[idx.Progress] = progress;

    // Stamping
    let stampSuffix = toActionHeaderSuffix(progress);
    let atField = 'Progress' + stampSuffix + 'At';
    let byField = 'Progress' + stampSuffix + 'By';
    if (idx[atField] !== undefined) rowData[idx[atField]] = formatDateTime24();
    if (idx[byField] !== undefined) rowData[idx[byField]] = auth.user.Name || auth.user.UserID;

    if (storageField && idx[storageField] !== undefined) {
      rowData[idx[storageField]] = storageValue;
    }

    let itemTimestamp = applyAuditFields(rowData, idx, auth, resource.config, false);
    if (itemTimestamp > maxItemTimestamp) maxItemTimestamp = itemTimestamp;
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([rowData]);
    item._rowData = rowData.slice();
    writtenRows.push(rowData);
  }
  if (writtenRows.length) {
    if (!_activeBatchWritePlan) SpreadsheetApp.flush();
    updateResourceSyncCursor('WarehouseTransferItems', maxItemTimestamp);
  }
}

function updateWarehouseTransferProgress(wtCode, progress, auth, fieldsToUpdate, existingContext) {
  var context = existingContext || getResourceRecordContextByCode('WarehouseTransfers', wtCode);
  if (!context) return null;

  var rowData = context.rowData.slice();
  var idx = context.idx;

  rowData[idx.Progress] = progress;
  var stampSuffix = toActionHeaderSuffix(progress);
  var atField = 'Progress' + stampSuffix + 'At';
  var byField = 'Progress' + stampSuffix + 'By';
  if (idx[atField] !== undefined) rowData[idx[atField]] = formatDateTime24();
  if (idx[byField] !== undefined) rowData[idx[byField]] = auth.user.Name || auth.user.UserID;

  if (fieldsToUpdate) {
    Object.keys(fieldsToUpdate).forEach(function(k) {
      if (idx[k] !== undefined) rowData[idx[k]] = fieldsToUpdate[k];
    });
  }

  var transferTimestamp = applyAuditFields(rowData, idx, auth, context.resource.config, false);
  context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).setValues([rowData]);
  updateResourceSyncCursor('WarehouseTransfers', transferTimestamp);
  return rowArrayToObject(context.headers, rowData);
}
