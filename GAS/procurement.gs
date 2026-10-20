/**
 * ============================================================
 * AQL - Procurement PostAction Hooks
 * ============================================================
 * Narrow procurement-specific postAction hooks.
 * Current responsibility:
 * - after Procurements create, write the new Procurement code back
 *   to the linked Purchase Requisition when the create payload
 *   includes `linkedPurchaseRequisitionCode`.
 * ============================================================
 */

var PROCUREMENT_RESOURCE_NAME = 'Procurements';
var PURCHASE_REQUISITIONS_RESOURCE_NAME = 'PurchaseRequisitions';

/**
 * PostAction hook for Procurements create.
 *
 * Resource config:
 *   Procurements.PostAction = 'linkProcurementCodeToPurchaseRequisition'
 *
 * Expected payload shape:
 * {
 *   data: { ...procurement fields... },
 *   linkedPurchaseRequisitionCode: 'PR26000001'
 * }
 */
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
  var normalizedCode = (code || '').toString().trim();
  if (!normalizedCode) return null;

  var resource = openResourceSheet(resourceName);
  var sheet = resource.sheet;
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idx = getHeaderIndexMap(headers);
  var rowNumber = findRowByValue(sheet, idx.Code, normalizedCode, 2, true);
  if (rowNumber === -1) return null;

  var rowData = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  return {
    resource: resource,
    sheet: sheet,
    headers: headers,
    idx: idx,
    rowNumber: rowNumber,
    rowData: rowData
  };
}
