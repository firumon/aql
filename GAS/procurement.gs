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

function handlePurchaseRequisitions_afterExecuteAction(payload, result, auth, action, meta, resourceName) {
  var actionName = (meta && meta.actionName ? meta.actionName : (payload && payload.actionName ? payload.actionName : '')).toString().trim();
  var savedRecord = meta && meta.savedRecord ? meta.savedRecord : null;
  if (!savedRecord || !savedRecord.Code) return result;

  var prCode = (savedRecord.Code || '').toString().trim();
  var existingProcCode = (savedRecord.ProcurementCode || '').toString().trim();
  var user = auth && auth.user ? (auth.user.Name || auth.user.UserID || '') : '';
  var role = auth && auth.user ? (auth.user.Role || auth.user.RoleName || '') : '';

  if (actionName.toLowerCase() === 'approve') {
    if (!existingProcCode) {
      var procPayload = {
        resource: PROCUREMENT_RESOURCE_NAME,
        record: {
          Progress: 'PR_APPROVED',
          InitiatedDate: formatDateTime24(),
          CreatedUser: user,
          CreatedRole: role,
          Status: 'Active'
        }
      };
      var createRes = handleResourceCreateRecord(auth, procPayload);
      if (createRes && createRes.success && createRes.data && createRes.data.code) {
        var newProcCode = createRes.data.code.toString().trim();
        updateResourceRecordFieldsByCode(PURCHASE_REQUISITIONS_RESOURCE_NAME, prCode, {
          ProcurementCode: newProcCode
        }, auth);
        if (result && result.data) {
          result.data.procurementCode = newProcCode;
        }
      }
    } else {
      updateResourceRecordFieldsByCode(PROCUREMENT_RESOURCE_NAME, existingProcCode, {
        Progress: 'PR_APPROVED'
      }, auth);
    }
  } else if (actionName.toLowerCase() === 'reject') {
    if (existingProcCode) {
      updateResourceRecordFieldsByCode(PROCUREMENT_RESOURCE_NAME, existingProcCode, {
        Progress: 'CANCELLED'
      }, auth);
    }
  }

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

function updateResourceRecordFieldsByCode(resourceName, code, fields, auth) {
  var context = getResourceRecordContextByCode(resourceName, code);
  if (!context) return null;

  var rowData = context.rowData.slice();
  var fieldNames = Object.keys(fields || {});
  for (var i = 0; i < fieldNames.length; i++) {
    var fieldName = fieldNames[i];
    if (context.idx[fieldName] !== undefined) {
      rowData[context.idx[fieldName]] = fields[fieldName];
    }
  }

  var recordTimestamp = applyAuditFields(rowData, context.idx, auth, context.resource.config, false);
  context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).setValues([rowData]);
  updateResourceSyncCursor(resourceName, recordTimestamp);
  return rowArrayToObject(context.headers, rowData);
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
