import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { textOrRef, batchRef } from 'src/utils/appHelpers'
import { toDateOnly, addDays as shiftDays } from 'src/utils/dateHelpers'
import { resourceRow, findResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useAuth } from 'src/composables/core/useAuth'
import { stampFields } from 'src/utils/workflowStamp'
import {
  buildProcurementCreateNode, buildProcurementProgressNode, buildProcurementRollbackNode, buildProcurementCancelNode, PROCUREMENT_REF_PATH
} from 'src/_resource/Operation/Procurements/composables/useProcurementPayload'
import { RFQ_GENERATED, RFQ_SENT_TO_SUPPLIERS } from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import {
  planRequisitionFifoAllocations, buildRequisitionRfqFifoNodes
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import {
  DRAFT, ASSIGNED, SENT, CLOSED, CANCELLED, SUPPLIER_ASSIGNED, SUPPLIER_SENT, SUPPLIER_RESPONDED, SUPPLIER_CANCELLED,
  supplierRowsOf, activeSupplierRowsOf, rfqCancelBlocker, progressOf, allSuppliersDispatched, canAssignSuppliers, canClose,
  isDraft, isEditable, isActiveRow, isTerminal
} from './useRFQProgress'
export const RESOURCE_NAME = 'RFQs'
export const ITEMS_RESOURCE = 'RFQItems'
export const SUPPLIERS_RESOURCE = 'RFQSuppliers'
export const CLOSE_ACTION = { action: 'Close', column: 'Progress', columnValue: CLOSED }
export const RFQ_REF_PATH = 'RFQs.latest.code'
export { SUPPLIER_SENT, allSuppliersDispatched }
const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const codesOf = (value) => [...new Set((Array.isArray(value) ? value : text(value).split(',')).map(text).filter(Boolean))]
const activeItems = (rows) => rows.filter((row) => row && isActiveRow(row) && row._action !== 'deactivate')

export function toDateInputValue (date = new Date()) { return toDateOnly(date) }

export function addDays (dateValue, days = 0) {
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue) && toDateOnly(dateValue) !== dateValue) return ''
  return toDateOnly(shiftDays(dateValue || new Date(), Number(days) || 0))
}

function defaultSettingDays (name, fallback = 0) {
  const config = findResourceConfig(RESOURCE_NAME)
  const settings = config?.settings || config?.ui?.settings || []
  const setting = Array.isArray(settings) ? settings.find((entry) => entry.name === name) : null
  const days = setting && String(setting.value ?? '').trim() !== '' ? Number(setting.value) : fallback
  return Number.isFinite(days) && days > 0 ? days : 0
}
export function defaultSubmissionDays () { return defaultSettingDays('DefaultQuotationSubmissionDays', 14) || 14 }
export function defaultRequiredByDays () { return defaultSettingDays('DefaultRequiredByDays', 0) }

function requirementFields (record) {
  return Object.fromEntries((findResourceConfig(RESOURCE_NAME)?.headers || [])
    .filter((column) => column.startsWith('Requirement')).map((column) => [column, record[column] ?? '']))
}

export function rfqItemRow (child = {}, extra = {}) {
  return resourceRow(ITEMS_RESOURCE, { Quantity: 1, Status: 'Active' }, child, extra)
}

export function buildRFQItemRecords (items = [], deactivatedCodes = []) {
  const rows = Array.isArray(items) ? items : []
  const records = activeItems(rows).map((row) => rfqItemRow(row, {
    _action: text(row.Code) ? 'update' : 'create', SKU: text(row.SKU), Quantity: Number(row.Quantity)
  }))
  const removed = codesOf([...deactivatedCodes, ...rows.filter((row) => row?._action === 'deactivate').map((row) => row.Code)])
  return [...records, ...removed.map((Code) => ({ _action: 'deactivate', Code, Status: 'Inactive' }))]
}

export function buildRFQItemSelectionNodes ({ items = [], selection = {} } = {}) {
  const allRows = Array.isArray(items) ? items : []
  const current = new Map(activeItems(allRows).map(row => [row.SKU, row]))
  const skus = useSkuResource()
  const records = Object.entries(selection).map(([SKU, Quantity]) => rfqItemRow(current.get(SKU), {
    SKU, Quantity: Number(Quantity), UOM: skus.skuLabelOf(SKU).uom
  }))
  const selectedSkus = new Set(Object.keys(selection))
  const deactivatedCodes = allRows
    .filter(row => text(row?.Code) && (row._action === 'deactivate' || !selectedSkus.has(text(row.SKU))))
    .map(row => text(row.Code))
  return [{ resource: RESOURCE_NAME, merge: true,
    children: [{ resource: ITEMS_RESOURCE, records: buildRFQItemRecords(records, deactivatedCodes) }] }]
}

export function buildRFQInitNodes (overrides = {}) {
  const { user } = useAuth()
  const today = toDateInputValue()
  const requiredDays = defaultRequiredByDays()
  return [{
    resource: RESOURCE_NAME,
    record: resourceRow(RESOURCE_NAME, {
      ProcurementCode: '', PurchaseRequisitionCodes: '', Username: text(user.value?.name), WarehouseCode: '',
      Type: 'STOCK', TypeReferenceCode: '', Priority: 'Medium', Remarks: '', RFQDate: today,
      QuotationSubmissionDeadline: addDays(today, defaultSubmissionDays()),
      RequiredBy: requiredDays > 0 ? addDays(today, requiredDays) : '', Progress: DRAFT, Status: 'Active', ...overrides
    }),
    children: [{ resource: ITEMS_RESOURCE, records: [] }],
    permissions: { create: 'You are not allowed to create an RFQ.' }
  }]
}

export function buildRFQEditInitNodes (record = {}) {
  if (!text(record.Code)) return [{ valid: false, message: 'No RFQ loaded.' }]
  return [{
    resource: RESOURCE_NAME, code: text(record.Code),
    record: buildRFQRecord({ form: { ...record, Username: record.Username ?? record.User ?? '',
      PurchaseRequisitionCodes: record.PurchaseRequisitionCodes ?? record.PurchaseRequisitionCode ?? '' },
    progress: record.Progress }),
    permissions: { update: 'You are not allowed to update this RFQ.' }
  }]
}

export function buildRFQRecord ({ requisition = {}, requisitions = [], form = {}, procurementCode = '', progress = '' } = {}) {
  const input = asRow(form)
  const { user } = useAuth()
  return {
    ProcurementCode: textOrRef(procurementCode || input.ProcurementCode || requisition?.ProcurementCode),
    PurchaseRequisitionCodes: codesOf(input.PurchaseRequisitionCodes ?? input.PurchaseRequisitionCode ??
      (requisitions.length ? requisitions.map((row) => row.Code) : requisition?.Code)).join(','),
    Username: text(input.Username ?? input.User ?? user.value?.name), WarehouseCode: text(input.WarehouseCode),
    Type: text(input.Type) || 'STOCK', TypeReferenceCode: text(input.TypeReferenceCode),
    Priority: text(input.Priority) || 'Medium', Remarks: String(input.Remarks ?? ''),
    RFQDate: toDateOnly(input.RFQDate), QuotationSubmissionDeadline: toDateOnly(input.QuotationSubmissionDeadline ?? input.SubmissionDeadline),
    RequiredBy: toDateOnly(input.RequiredBy),
    ...requirementFields(input), Progress: progress || input.Progress || DRAFT, Status: 'Active'
  }
}

export function buildSupplierRecord ({ rfqCode = '', procurementCode = '', supplierCode = '' } = {}) {
  return { ProcurementCode: textOrRef(procurementCode), RFQCode: textOrRef(rfqCode), SupplierCode: text(supplierCode),
    SentDate: '', Progress: SUPPLIER_ASSIGNED, Status: 'Active' }
}

function buildSupplierAssignRecords ({ rfqCode, procurementCode, supplierCodes = [], existingSupplierRows = [] }) {
  const existing = new Map(supplierRowsOf({ Code: rfqCode }, existingSupplierRows)
    .map((row) => [text(row.SupplierCode), row]))
  const records = []
  for (const supplierCode of codesOf(supplierCodes)) {
    const row = existing.get(supplierCode)
    if (!row) {
      records.push({ _action: 'create', ...buildSupplierRecord({ rfqCode, procurementCode, supplierCode }) })
    } else if (progressOf(row) === SUPPLIER_CANCELLED) {
      records.push({ _action: 'update', Code: text(row.Code), ProcurementCode: textOrRef(procurementCode),
        RFQCode: textOrRef(rfqCode), SupplierCode: supplierCode, SentDate: '', ProgressSentAt: '', ProgressSentBy: '',
        ProgressSentComment: '', ProgressRespondedAt: '', ProgressRespondedBy: '', ProgressRespondedComment: '',
        ProgressCancelledAt: '', ProgressCancelledBy: '', ProgressCancelledComment: '', Progress: SUPPLIER_ASSIGNED,
        Status: 'Active' })
    }
  }
  const permissions = {}
  if (records.some((row) => row._action === 'create')) permissions.create = 'You are not allowed to create an RFQ supplier.'
  if (records.some((row) => row._action === 'update')) permissions.update = 'You are not allowed to update RFQ suppliers.'
  return { records, permissions }
}

export function buildRFQCreateChainNodes (options = {}) {
  return buildRFQSaveChainNodes({ ...options, rfq: null, code: '' })
}

export function buildRFQSaveChainNodes ({
  rfq = null, code = '', requisition = null, requisitions = [], items = null, rfqItems = [], previousItems = null,
  prItems = [], form = {}, procurement = null, procurementCode = '', suppliers = [], existingSupplierRows = [],
  prCodes, actorName = '', actorRole = '', directItems = [], warehouseCode = ''
} = {}) {
  const key = text(code || rfq?.Code)
  if (key && (!rfq || !isEditable(rfq))) return [{ valid: false, message: 'Only a draft or assigned RFQ can be edited.' }]
  if (![requisitions, rfqItems, prItems, suppliers, existingSupplierRows].every(Array.isArray) ||
    items !== null && !Array.isArray(items) || previousItems !== null && !Array.isArray(previousItems)) {
    return [{ valid: false, message: 'Pass RFQ items, PR rows, and suppliers as lists.' }]
  }
  const parents = requisitions.length ? requisitions : requisition ? [requisition] : []
  const input = { ...asRow(rfq), ...form }
  const selected = codesOf(prCodes ?? input.PurchaseRequisitionCodes ?? input.PurchaseRequisitionCode ??
    (requisition ? [requisition.Code] : []))
  const source = items ?? (rfqItems.length ? rfqItems : directItems.map((row) => ({
    SKU: row.sku, Quantity: row.quantity, UOM: row.uom, Description: row.description, Status: 'Active'
  })))
  const lines = activeItems(source)
  if (!lines.length) return [{ valid: false, message: 'Add at least one item to quote.' }]
  if (lines.some((row) => !text(row.SKU) || !Number.isFinite(Number(row.Quantity)) || Number(row.Quantity) <= 0) ||
    new Set(lines.map((row) => text(row.SKU))).size !== lines.length) {
    return [{ valid: false, message: 'Use a different SKU and a quantity above zero for each item.' }]
  }
  const previous = key ? (previousItems ?? (rfqItems.length ? rfqItems : source)).filter(isActiveRow) : []
  const oldByCode = new Map(previous.filter((row) => text(row.Code)).map((row) => [text(row.Code), row]))
  const retained = new Set(lines.map((row) => text(row.Code)).filter(Boolean))
  const requests = lines.map((row) => ({
    sku: text(row.SKU), quantity: Number(row.Quantity),
    previousAllocations: key ? (oldByCode.get(text(row.Code)) || row).Allocations : undefined
  }))
  const removed = previous.filter((row) => !retained.has(text(row.Code)))
  requests.push(...removed.map((row) => ({ sku: text(row.SKU), quantity: 0, previousAllocations: row.Allocations })))
  const allocationInputs = { requisitions: parents, items: prItems, itemRequests: requests, prCodes: selected }
  const plan = planRequisitionFifoAllocations(allocationInputs)
  if (!plan.ok) return [{ valid: false, message: plan.message }]
  const rfqCode = key || batchRef(RFQ_REF_PATH)
  const prNodes = buildRequisitionRfqFifoNodes({ rfqCode, ...allocationInputs })
  if (prNodes.some((node) => node.valid === false)) return prNodes
  const linkedProcurement = procurementCode || input.ProcurementCode || procurement?.Code
  const freshProcurement = !key && (!linkedProcurement || linkedProcurement?.$ref === PROCUREMENT_REF_PATH ||
    linkedProcurement === '$ref:' + PROCUREMENT_REF_PATH)
  const procurementRef = freshProcurement ? batchRef(PROCUREMENT_REF_PATH) : linkedProcurement
  const supplierCodes = codesOf(suppliers)
  const alreadyActive = activeSupplierRowsOf({ Code: key }, existingSupplierRows)
  const progress = supplierCodes.length || alreadyActive.length ? ASSIGNED : DRAFT
  const records = lines.map((row, index) => rfqItemRow(row, {
    ...(!key ? { Code: '' } : {}), RFQCode: rfqCode,
    PurchaseRequisitionItemCodes: plan.results[index].purchaseRequisitionItemCodes, Allocations: plan.results[index].allocationsJson
  }))
  const nodes = []
  if (freshProcurement) nodes.push(buildProcurementCreateNode({ progress: RFQ_GENERATED, actorName, actorRole }))
  nodes.push({
    resource: RESOURCE_NAME, ...(key ? { code: key } : {}),
    record: buildRFQRecord({ form: { ...input, PurchaseRequisitionCodes: selected.join(','),
      WarehouseCode: input.WarehouseCode || warehouseCode }, procurementCode: procurementRef, progress }),
    children: [{ resource: ITEMS_RESOURCE, records: buildRFQItemRecords(records,
      [...removed.map((row) => row.Code), ...source.filter((row) => row?._action === 'deactivate').map((row) => row.Code)]) }],
    permissions: key ? { update: 'You are not allowed to update this RFQ.' } : { create: 'You are not allowed to create an RFQ.' },
    successMsg: key ? 'RFQ updated.' : 'RFQ generated.'
  })
  const supplierAssignments = buildSupplierAssignRecords({ rfqCode, procurementCode: procurementRef,
    supplierCodes, existingSupplierRows })
  if (supplierAssignments.records.length) nodes.push({
    resource: SUPPLIERS_RESOURCE, many: true,
    records: supplierAssignments.records,
    permissions: supplierAssignments.permissions
  })
  nodes.push(...prNodes)
  return nodes
}

export function buildRFQCancelChainNodes ({
  rfq = null, rfqItems = [], requisitions = [], prItems = [], supplierRows = [], procurement = null,
  quotations = [], purchaseOrders = [], actorName = '', comment = ''
} = {}) {
  const blocker = rfqCancelBlocker(rfq, { quotations, purchaseOrders })
  if (blocker) return [{ valid: false, message: blocker }]
  if (!text(comment)) return [{ valid: false, message: 'Enter a cancellation reason.' }]
  if (![rfqItems, requisitions, prItems, supplierRows, quotations, purchaseOrders].every(Array.isArray)) {
    return [{ valid: false, message: 'Pass RFQ items, PR rows, and suppliers as lists.' }]
  }
  const reversals = buildRequisitionRfqFifoNodes({
    rfqCode: rfq.Code, requisitions, items: prItems, prCodes: [],
    itemRequests: activeItems(rfqItems).map((row) => ({
      sku: text(row.SKU), quantity: 0, previousAllocations: row.Allocations
    }))
  })
  if (reversals.some((node) => node.valid === false)) return reversals
  const stamp = stampFields('ProgressCancelled', actorName, comment)
  const nodes = [{
    resource: RESOURCE_NAME,
    actions: [{ action: 'Cancel', column: 'Progress', columnValue: CANCELLED, code: text(rfq.Code),
      data: { fields: { Comment: text(comment), ...stamp } } }],
    permissions: { cancel: 'You are not allowed to cancel this RFQ.' }, successMsg: 'RFQ cancelled.'
  }, ...reversals]
  const procComment = `RFQ cancelled, hence Procurement cancelled. Reason: ${text(comment)}`
  const cancelProc = buildProcurementCancelNode(procurement, { actorName, comment: procComment })
  if (cancelProc) nodes.push(cancelProc)
  return nodes
}

export function buildAssignSuppliersChainNodes ({ rfq = null, supplierCodes = [], existingSupplierRows = [] } = {}) {
  const record = asRow(rfq)
  const code = text(record.Code)
  if (!code) {
    return [{ valid: false, message: 'No RFQ loaded.' }]
  }
  if (!canAssignSuppliers(record)) {
    return [{ valid: false, message: 'This RFQ is closed or cancelled.' }]
  }
  const assignments = buildSupplierAssignRecords({ rfqCode: code, procurementCode: text(record.ProcurementCode),
    supplierCodes, existingSupplierRows })
  if (!assignments.records.length) return [{ valid: false, message: 'Select at least one supplier to assign.' }]
  const nodes = [{
    resource: SUPPLIERS_RESOURCE,
    many: true,
    records: assignments.records,
    permissions: assignments.permissions,
    successMsg: 'Suppliers assigned.'
  }]
  if (isDraft(record)) nodes.push({
    resource: RESOURCE_NAME, code, record: { Progress: ASSIGNED },
    permissions: { update: 'You are not allowed to update this RFQ.' }
  })
  return nodes
}

export function buildManageSuppliersStatusChainNodes ({
  rfq = null, supplierRowCodes = [], statusByCode = null, supplierRows = [], procurement = null,
  nextStatus = '', comment = '', actorName = ''
} = {}) {
  const record = asRow(rfq)
  const code = text(record.Code)
  if (!code) return [{ valid: false, message: 'No RFQ loaded.' }]
  if (!canAssignSuppliers(record)) return [{ valid: false, message: 'This RFQ is closed or cancelled.' }]
  const statusEntries = statusByCode && typeof statusByCode === 'object' && !Array.isArray(statusByCode)
    ? Object.entries(statusByCode) : []
  const usesStatusByCode = statusEntries.length > 0
  const targetByCode = new Map(statusEntries.map(([rowCode, status]) => [
    text(rowCode), text(status).toUpperCase()
  ]))
  const validTargets = [SUPPLIER_ASSIGNED, SUPPLIER_SENT, SUPPLIER_CANCELLED]
  if (usesStatusByCode && statusEntries.some(([, status]) => !validTargets.includes(text(status).toUpperCase()))) {
    return [{ valid: false, message: 'Choose a valid supplier status.' }]
  }
  const target = text(nextStatus).toUpperCase()
  if (!usesStatusByCode && !validTargets.includes(target)) {
    return [{ valid: false, message: 'Choose a valid supplier status.' }]
  }
  if (!usesStatusByCode && target === SUPPLIER_CANCELLED && !text(comment)) {
    return [{ valid: false, message: 'Enter a cancellation reason.' }]
  }
  const selectedSet = new Set(codesOf(supplierRowCodes))
  const allRfqRows = supplierRowsOf(record, supplierRows)
  const targetRows = allRfqRows.filter((row) => {
    const rowCode = text(row.Code)
    return (usesStatusByCode ? targetByCode.has(rowCode) : selectedSet.has(rowCode)) &&
      progressOf(row) !== SUPPLIER_RESPONDED
  })
  if (!targetRows.length) return [{ valid: false, message: 'Select at least one non-responded supplier.' }]
  const targetForRow = (row) => usesStatusByCode ? targetByCode.get(text(row.Code)) : target
  const rowsToUpdate = targetRows.filter((row) => progressOf(row) !== targetForRow(row))
  if (!rowsToUpdate.length) return [{ valid: false, message: 'Selected suppliers are already in that status.' }]
  if (usesStatusByCode && rowsToUpdate.some((row) => targetForRow(row) === SUPPLIER_CANCELLED) && !text(comment)) {
    return [{ valid: false, message: 'Enter a cancellation reason.' }]
  }
  const recordsToUpdate = rowsToUpdate.map((row) => {
    const rowTarget = targetForRow(row)
    if (rowTarget === SUPPLIER_ASSIGNED) return {
      Code: text(row.Code), SentDate: '',
      ProgressSentAt: '', ProgressSentBy: '', ProgressSentComment: '',
      ProgressRespondedAt: '', ProgressRespondedBy: '', ProgressRespondedComment: '',
      ProgressCancelledAt: '', ProgressCancelledBy: '', ProgressCancelledComment: '',
      Progress: SUPPLIER_ASSIGNED, Status: 'Active'
    }
    if (rowTarget === SUPPLIER_SENT) {
      const today = toDateInputValue()
      const sentStamp = stampFields('ProgressSent', actorName, '')
      return {
        Code: text(row.Code), SentDate: text(row.SentDate) || today, ...sentStamp,
        ProgressRespondedAt: '', ProgressRespondedBy: '', ProgressRespondedComment: '',
        ProgressCancelledAt: '', ProgressCancelledBy: '', ProgressCancelledComment: '',
        Progress: SUPPLIER_SENT, Status: 'Active'
      }
    }
    const cancelStamp = stampFields('ProgressCancelled', actorName, comment)
    return { Code: text(row.Code), Progress: SUPPLIER_CANCELLED, ...cancelStamp }
  })
  const updatedMap = new Map(rowsToUpdate.map((row) => [text(row.Code), targetForRow(row)]))
  const resultingRows = allRfqRows.map((row) => ({ ...row, Progress: updatedMap.get(text(row.Code)) || progressOf(row) }))
  const activeAfter = resultingRows.filter((row) => progressOf(row) !== SUPPLIER_CANCELLED)
  const hasSentOrResponded = activeAfter.some((row) => [SUPPLIER_SENT, SUPPLIER_RESPONDED].includes(progressOf(row)))
  const hasAssigned = activeAfter.some((row) => progressOf(row) === SUPPLIER_ASSIGNED)
  const nextRfqProgress = hasSentOrResponded ? SENT : (hasAssigned ? ASSIGNED : DRAFT)
  const updatedTargets = new Set(rowsToUpdate.map(targetForRow))
  const successMsg = updatedTargets.size > 1 ? 'Supplier statuses updated.'
    : [...updatedTargets][0] === SUPPLIER_ASSIGNED ? 'Suppliers moved to Assigned.'
      : [...updatedTargets][0] === SUPPLIER_SENT ? 'Suppliers marked as Sent.' : 'Suppliers cancelled.'
  const nodes = [{
    resource: SUPPLIERS_RESOURCE, many: true, records: recordsToUpdate,
    permissions: { update: 'You are not allowed to update RFQ suppliers.' }, successMsg
  }]
  if (progressOf(record) !== nextRfqProgress) nodes.push({
    resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: nextRfqProgress },
    permissions: { update: 'You are not allowed to update this RFQ.' }
  })
  if (nextRfqProgress === SENT && activeAfter.length && !hasAssigned) {
    const advance = buildProcurementProgressNode(procurement, RFQ_SENT_TO_SUPPLIERS)
    if (advance) nodes.push(advance)
  } else if ((nextRfqProgress === ASSIGNED || nextRfqProgress === DRAFT) && progressOf(procurement) === RFQ_SENT_TO_SUPPLIERS) {
    const rollback = buildProcurementRollbackNode(procurement, RFQ_GENERATED)
    if (rollback) nodes.push(rollback)
  }
  return nodes
}

export function buildSupplierRespondedNodes ({ supplierRow = null, actorName = '' } = {}) {
  const row = asRow(supplierRow)
  const code = text(row.Code)
  if (!code) return []
  const progress = text(row.Progress).toUpperCase()
  if (![SUPPLIER_ASSIGNED, SUPPLIER_SENT].includes(progress)) return []
  const stamp = stampFields('ProgressSent', actorName, 'Send not recorded; inferred from supplier reply')
  const responseStamp = stampFields('ProgressResponded', actorName, 'Supplier response captured')
  return [{
    resource: SUPPLIERS_RESOURCE,
    many: true,
    records: [{ Code: code, Progress: SUPPLIER_RESPONDED, ...responseStamp,
      ...(progress === SUPPLIER_ASSIGNED ? {
        ...stamp
      } : {}) }],
    permissions: { update: 'You are not allowed to update this RFQ supplier.' }
  }]
}

export function buildSupplierCancelledNodes (rfqCode, supplierCode, supplierRows = [], actorName = '', comment = '') {
  const rows = supplierRowsOf({ Code: rfqCode }, supplierRows)
    .filter((row) => text(row.SupplierCode) === text(supplierCode))
  if (!rows.length) return []
  const stamp = stampFields('ProgressCancelled', actorName, comment)
  return [{
    resource: SUPPLIERS_RESOURCE,
    many: true,
    records: rows.map((row) => ({ Code: text(row.Code), Progress: SUPPLIER_CANCELLED, ...stamp }))
  }]
}

export function buildRFQCloseNode (rfq, actorName = '', comment = '') {
  const record = asRow(rfq)
  if (!text(record.Code) || !canClose(record)) return null
  return {
    resource: RESOURCE_NAME,
    actions: [{
      ...CLOSE_ACTION,
      code: textOrRef(record.Code),
      data: { fields: stampFields('ProgressClosed', actorName, comment) }
    }],
    permissions: { close: 'You are not allowed to close this RFQ.' }
  }
}

export function buildRFQReopenNode (rfq) {
  const record = asRow(rfq)
  if (!text(record.Code) || text(record.Progress).toUpperCase() !== CLOSED) return null
  return {
    resource: RESOURCE_NAME,
    code: textOrRef(record.Code),
    record: {
      Progress: SENT,
      ProgressClosedComment: '',
      ProgressClosedAt: '',
      ProgressClosedBy: ''
    }
  }
}

export function buildRFQCloseChainNodes ({ rfq = null, actorName = '', comment = '' } = {}) {
  const request = buildRFQCloseNode(rfq, actorName, comment)
  if (!request) {
    return [{ valid: false, message: 'Only a sent RFQ can be closed.' }]
  }
  return [{ ...request, successMsg: 'RFQ closed.' }]
}

export function useRFQPayload () {
  return {
    buildRFQInitNodes,
    buildRFQEditInitNodes,
    buildRFQRecord,
    defaultRequiredByDays,
    buildSupplierRecord,
    buildRFQCreateChainNodes,
    buildRFQSaveChainNodes,
    buildRFQCancelChainNodes,
    rfqItemRow,
    buildRFQItemRecords,
    buildAssignSuppliersChainNodes,
    buildManageSuppliersStatusChainNodes,
    buildSupplierRespondedNodes,
    buildSupplierCancelledNodes,
    buildRFQCloseNode,
    buildRFQReopenNode,
    buildRFQCloseChainNodes,
    allSuppliersDispatched,
    toDateInputValue,
    addDays
  }
}
