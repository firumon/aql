import { textOrRef, batchRef } from 'src/utils/appHelpers'
import { resourceRow, findResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useAuth } from 'src/composables/core/useAuth'
import { stampFields } from 'src/utils/workflowStamp'
import { buildProcurementCreateNode, buildProcurementProgressNode, PROCUREMENT_REF_PATH } from 'src/_resource/Operation/Procurements/composables/useProcurementPayload'
import {
  RFQ_GENERATED,
  RFQ_SENT_TO_SUPPLIERS
} from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import {
  buildRequisitionCompositeNode,
  buildRequisitionRfqProcessedNode,
  defaultRequiredDate
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import { RFQ_PROCESSED } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'
import {
  DRAFT,
  SENT,
  CLOSED,
  SUPPLIER_ASSIGNED,
  SUPPLIER_SENT,
  SUPPLIER_RESPONDED,
  SUPPLIER_CANCELLED,
  supplierRowsOf,
  allSuppliersDispatched,
  canAssignSuppliers,
  canMarkSuppliersSent,
  canClose,
  isDraft
} from './useRFQProgress'

const RESOURCE_NAME = 'RFQs'
const SUPPLIERS_RESOURCE = 'RFQSuppliers'
const REFRESH_RESOURCES = ['RFQs', 'RFQSuppliers', 'PurchaseRequisitions', 'Procurements']

export const CLOSE_ACTION = { action: 'Close', column: 'Progress', columnValue: CLOSED }
export const RFQ_REF_PATH = 'RFQs.latest.code'

export { RESOURCE_NAME, SUPPLIERS_RESOURCE, SUPPLIER_SENT }

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asRow = (value) => (value && typeof value === 'object' ? value : {})

function pad (value) { return String(value).padStart(2, '0') }

export function toDateInputValue (date = new Date()) {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

export function addDays (dateValue, days = 0) {
  const calendarDate = typeof dateValue === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  if (calendarDate) {
    const [, year, month, day] = calendarDate
    const base = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (base.getUTCFullYear() !== Number(year) || base.getUTCMonth() !== Number(month) - 1 || base.getUTCDate() !== Number(day)) return ''
    base.setUTCDate(base.getUTCDate() + num(days))
    return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`
  }
  const base = dateValue ? new Date(dateValue) : new Date()
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + num(days))
  return toDateInputValue(base)
}

export function defaultSubmissionDays () {
  const config = findResourceConfig(RESOURCE_NAME)
  const settings = config?.settings || config?.ui?.settings || []
  const setting = Array.isArray(settings) ? settings.find((entry) => entry.name === 'DefaultQuotationSubmissionDays') : null
  const days = setting ? Number(setting.value) : 14
  return Number.isFinite(days) && days > 0 ? days : 14
}

export function buildRFQInitNodes (overrides = {}) {
  const today = toDateInputValue()
  const { user } = useAuth()
  const userName = text(user.value?.name)
  return [{
    resource: RESOURCE_NAME,
    record: resourceRow(RESOURCE_NAME, {
      RFQDate: today,
      User: userName,
      QuotationSubmissionDeadline: addDays(today, defaultSubmissionDays()),
      PurchaseRequisitionCode: '',
      ProcurementCode: '',
      ...overrides
    }),
    permissions: { create: 'You are not allowed to create an RFQ.' }
  }]
}

export function buildRFQEditInitNodes (record = {}) {
  const row = asRow(record)
  const code = text(row.Code)
  if (!code) return [{ valid: false, message: 'No RFQ loaded.' }]
  return [{
    resource: RESOURCE_NAME,
    code: textOrRef(code),
    record: {
      ProcurementCode: text(row.ProcurementCode),
      PurchaseRequisitionCode: text(row.PurchaseRequisitionCode),
      User: row.User !== undefined ? row.User : '',
      RFQDate: text(row.RFQDate),
      QuotationSubmissionDeadline: text(row.QuotationSubmissionDeadline ?? row.SubmissionDeadline),
      ...Object.fromEntries((findResourceConfig(RESOURCE_NAME)?.headers || [])
        .filter((column) => column.startsWith('Criterion'))
        .map((column) => [column, row[column] ?? '']))
    },
    permissions: { update: 'You are not allowed to update this RFQ.' }
  }]
}

export function buildRFQRecord ({ requisition = {}, items = [], form = {}, procurementCode = '' } = {}) {
  const pr = asRow(requisition)
  const input = asRow(form)
  const { user } = useAuth()
  const linkedProcurement = procurementCode || pr.ProcurementCode || input.ProcurementCode
  const linkedRequisition = pr.Code || input.PurchaseRequisitionCode
  return {
    ProcurementCode: textOrRef(linkedProcurement),
    PurchaseRequisitionCode: textOrRef(linkedRequisition),
    User: input.User !== undefined ? input.User : String(user.value?.name ?? ''),
    RFQDate: text(input.RFQDate),
    QuotationSubmissionDeadline: text(input.QuotationSubmissionDeadline),
    ...Object.fromEntries((findResourceConfig(RESOURCE_NAME)?.headers || [])
      .filter((column) => column.startsWith('Criterion'))
      .map((column) => [column, input[column] ?? ''])),
    Progress: DRAFT,
    Status: 'Active'
  }
}

export function buildSupplierRecord ({ rfqCode = '', procurementCode = '', supplierCode = '' } = {}) {
  return {
    ProcurementCode: textOrRef(procurementCode),
    RFQCode: textOrRef(rfqCode),
    SupplierCode: text(supplierCode),
    SentDate: '',
    Progress: SUPPLIER_ASSIGNED,
    Status: 'Active'
  }
}

export function buildRFQCreateChainNodes ({
  requisition = null,
  items = [],
  form = {},
  procurement = null,
  suppliers = [],
  sourceType = 'PR',
  directItems = [],
  warehouseCode = '',
  actorName = '',
  actorRole = ''
} = {}) {
  if (sourceType === 'DIRECT') {
    const lines = (Array.isArray(directItems) ? directItems : []).map(asRow)
      .filter((row) => text(row.sku) && Number.isFinite(Number(row.quantity)) && Number(row.quantity) > 0)
    if (!lines.length) return [{ valid: false, message: 'Add at least one SKU to quote.' }]
    if (!text(warehouseCode)) return [{ valid: false, message: 'An active warehouse is required to create the purchase requisition.' }]

    const procurementRef = batchRef(PROCUREMENT_REF_PATH)
    const procurementNode = buildProcurementCreateNode({
      progress: RFQ_GENERATED,
      actorName,
      actorRole
    })
    const requisitionNode = buildRequisitionCompositeNode({
      form: resourceRow('PurchaseRequisitions', {
        PRDate: toDateInputValue(),
        RequiredDate: defaultRequiredDate(),
        WarehouseCode: text(warehouseCode),
        Username: text(actorName)
      }),
      targetProgress: RFQ_PROCESSED,
      extraFields: {
        ProcurementCode: procurementRef,
        ...stampFields('ProgressApproved', actorName, 'Created from Direct RFQ')
      },
      items: lines.map((row) => resourceRow('PurchaseRequisitionItems', {
        SKU: text(row.sku),
        ...(text(row.uom) ? { UOM: text(row.uom) } : {}),
        Quantity: Number(row.quantity),
        Description: String(row.description ?? '')
      }))
    })
    requisitionNode.permissions = {
      create: 'You are not allowed to create a purchase requisition.',
      review: 'You are not allowed to approve a purchase requisition.'
    }

    const nodes = [procurementNode, requisitionNode, {
      resource: RESOURCE_NAME,
      record: buildRFQRecord({
        form,
        procurementCode: procurementRef,
        requisition: { Code: batchRef('PurchaseRequisitions.latest.code') }
      }),
      permissions: { create: 'You are not allowed to create an RFQ.' },
      successMsg: 'RFQ generated.'
    }]

    const supplierCodes = Array.from(new Set((Array.isArray(suppliers) ? suppliers : []).map(text).filter(Boolean)))
    if (supplierCodes.length) {
      nodes.push({
        resource: SUPPLIERS_RESOURCE,
        many: true,
        records: supplierCodes.map((supplierCode) => buildSupplierRecord({
          rfqCode: batchRef(RFQ_REF_PATH),
          procurementCode: procurementRef,
          supplierCode
        })),
        permissions: { create: 'You are not allowed to create an RFQ supplier.' }
      })
    }

    nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })
    return nodes
  }

  const pr = asRow(requisition)
  if (!text(pr.Code)) {
    return [{ valid: false, message: 'Select an approved purchase requisition.' }]
  }
  const lines = (Array.isArray(items) ? items : []).map(asRow).filter((row) => text(row.Code))
  if (!lines.length) {
    return [{ valid: false, message: 'Select at least one requisition item.' }]
  }

  const procurementCode = text(asRow(procurement).Code) || text(pr.ProcurementCode)
  const nodes = [{
    resource: RESOURCE_NAME,
    record: buildRFQRecord({ requisition: pr, items: lines, form, procurementCode }),
    permissions: { create: 'You are not allowed to create an RFQ.' },
    successMsg: 'RFQ generated.'
  }]

  const supplierCodes = Array.from(new Set((Array.isArray(suppliers) ? suppliers : []).map(text).filter(Boolean)))
  if (supplierCodes.length) {
    nodes.push({
      resource: SUPPLIERS_RESOURCE,
      many: true,
      records: supplierCodes.map((supplierCode) => buildSupplierRecord({
        rfqCode: batchRef(RFQ_REF_PATH),
        procurementCode,
        supplierCode
      })),
      permissions: { create: 'You are not allowed to create an RFQ supplier.' }
    })
  }

  const consumed = buildRequisitionRfqProcessedNode(pr.Code)
  if (consumed) nodes.push(consumed)

  const advance = buildProcurementProgressNode(procurement, RFQ_GENERATED)
  if (advance) nodes.push(advance)

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

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

  const already = new Set(supplierRowsOf(record, existingSupplierRows).map((row) => text(row.SupplierCode)))
  const selected = Array.from(new Set((Array.isArray(supplierCodes) ? supplierCodes : []).map(text).filter(Boolean)))
    .filter((supplierCode) => !already.has(supplierCode))

  if (!selected.length) {
    return [{ valid: false, message: 'Select at least one new supplier.' }]
  }

  const nodes = [{
    resource: SUPPLIERS_RESOURCE,
    many: true,
    records: selected.map((supplierCode) => buildSupplierRecord({
      rfqCode: code,
      procurementCode: text(record.ProcurementCode),
      supplierCode
    })),
    permissions: { create: 'You are not allowed to create an RFQ supplier.' },
    successMsg: 'Suppliers assigned.'
  }]

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

export function buildMarkAsSentChainNodes ({ rfq = null, supplierRowCodes = [], supplierRows = [], procurement = null, actorName = '' } = {}) {
  const record = asRow(rfq)
  const code = text(record.Code)
  if (!code) {
    return [{ valid: false, message: 'No RFQ loaded.' }]
  }
  if (!canMarkSuppliersSent(record)) {
    return [{ valid: false, message: 'This RFQ is not in a state where suppliers can be dispatched.' }]
  }

  const selected = new Set((Array.isArray(supplierRowCodes) ? supplierRowCodes : []).map(text).filter(Boolean))
  const active = supplierRowsOf(record, supplierRows)
  const rowsToSend = active.filter((row) =>
    selected.has(text(row.Code)) && text(row.Progress).toUpperCase() === SUPPLIER_ASSIGNED)

  if (!rowsToSend.length) {
    return [{ valid: false, message: 'Select at least one supplier that has not been sent yet.' }]
  }

  const today = toDateInputValue()
  const stamp = stampFields('ProgressSent', actorName, '')
  const nodes = [{
    resource: SUPPLIERS_RESOURCE,
    many: true,
    records: rowsToSend.map((row) => ({
      Code: text(row.Code),
      Progress: SUPPLIER_SENT,
      SentDate: text(row.SentDate) || today,
      ...stamp
    })),
    permissions: { update: 'You are not allowed to update this RFQ supplier.' },
    successMsg: 'Suppliers marked as sent.'
  }]

  if (isDraft(record)) {
    nodes.push({
      resource: RESOURCE_NAME,
      code: textOrRef(code),
      record: { Progress: SENT },
      permissions: { update: 'You are not allowed to update this RFQ.' }
    })
  }

  const sentCodes = new Set(rowsToSend.map((row) => text(row.Code)))
  const remaining = active.filter((row) =>
    !sentCodes.has(text(row.Code)) && text(row.Progress).toUpperCase() === SUPPLIER_ASSIGNED)

  if (!remaining.length) {
    const advance = buildProcurementProgressNode(procurement, RFQ_SENT_TO_SUPPLIERS)
    if (advance) nodes.push(advance)
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

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
  return [
    request,
    { resource: '$batch', reload: REFRESH_RESOURCES, successMsg: 'RFQ closed.' }
  ]
}

export function useRFQPayload () {
  return {
    buildRFQInitNodes,
    buildRFQEditInitNodes,
    buildRFQRecord,
    buildSupplierRecord,
    buildRFQCreateChainNodes,
    buildAssignSuppliersChainNodes,
    buildMarkAsSentChainNodes,
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
