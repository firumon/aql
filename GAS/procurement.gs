var PROCUREMENT_RESOURCE_NAME = 'Procurements';
var PURCHASE_REQUISITIONS_RESOURCE_NAME = 'PurchaseRequisitions';

function linkProcurementCodeToPurchaseRequisition_afterCreate(payload, result, auth, action, meta, resourceName) {
  return result;
}

function resolveCreatedProcurementCode(result, meta) {
  if (meta && meta.savedRecord && meta.savedRecord.Code) {
    return meta.savedRecord.Code.toString().trim();
  }

  if (result && result.data && result.data.code) {
    return result.data.code.toString().trim();
  }

  return '';
}

function getResourceRecordContextByCode(resourceName, code) {
  let normalizedCode = (code || '').toString().trim();
  if (!normalizedCode) return null;

  let resource = openResourceSheet(resourceName);
  let sheet = resource.sheet;
  const headers = getSheetHeadersByMeta(resource.config.fileId, resource.config.sheetName, sheet);
  let idx = getHeaderIndexMap(headers);
  let rowNumber = findRowByValue(sheet, idx.Code, normalizedCode, 2, true);
  if (rowNumber === -1) return null;

  let rowData = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  return {
    resource: resource,
    sheet: sheet,
    headers: headers,
    idx: idx,
    rowNumber: rowNumber,
    rowData: rowData
  };
}
