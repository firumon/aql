import { batchRef, textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import {
  SUBMITTED,
  CANCELLED,
  STOCKED,
  DISPOSED,
  isFlagged,
  returnRequiresTrack,
  REASON_REQUIRING_COMMENT,
  deriveReturnProgress,
  isCancelled,
  isEditable,
  invoiceAdjustmentRequired,
  warehouseActionRequired,
  warehouseActionCompleted
} from './useReturnProgress'

import { INTO_WAREHOUSE, STOCK_REFERENCE, stockMovementRow, buildStockMovementNodes } from 'src/_resource/Operation/StockMovements/composables/useStockMovementPayload'
import { OFF_THE_SHELF, ONTO_THE_SHELF, OUTLET_REFERENCE, outletMovementRow, buildOutletMovementNode, buildOutletMovementNodes } from 'src/_resource/Operation/OutletMovements/composables/useOutletMovementPayload'
const RESOURCE_NAME = 'OutletReturns' // this module IS OutletReturns — always

const STOCK_MOVEMENTS = 'StockMovements'

const REF_RETURN = 'OutletReturn'

export const RETURN_REF_PATH = `${RESOURCE_NAME}.latest.code`

const DEFAULT_STORAGE = '_default'

const AUDIT_COLUMNS = ['Code', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'AccessRegion']

const withoutAudit = (row) => {
  const out = { ...asRow(row) }
  for (const key of AUDIT_COLUMNS) delete out[key]
  return out
}

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])
const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

const flag = (value) => (isFlagged(value) ? 'TRUE' : 'FALSE')

export function returnQtyChange (qty, { invoiceRequired = false, warehouseRequired = false } = {}) {
  const quantity = Math.abs(toNumber(qty))
  if (invoiceRequired && !warehouseRequired) return quantity
  if (!invoiceRequired && warehouseRequired) return -quantity
  return 0
}

export function storedQtyChange (record) {
  const row = asRow(record)
  return returnQtyChange(row.Qty, {
    invoiceRequired: invoiceAdjustmentRequired(row),
    warehouseRequired: warehouseActionRequired(row)
  })
}

const shelfDirection = (qtyChange) => (toNumber(qtyChange) < 0 ? OFF_THE_SHELF : ONTO_THE_SHELF)

import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useReturnResource } from './useReturnResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { effectivePriceListCode, priceFromList, resolveReturnUnitPrice } from './useReturnPricing'
import { resourceRow } from 'src/composables/resources/useResourceConfig'
import { priceOf, priceListForOutlet } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'

export function returnRow (parent = {}, extra = {}) {
  const { user } = useAuth()
  const seed = { ...asRow(parent), ...asRow(extra) }
  const outletCode = text(seed.OutletCode)
  const priceListCode = text(seed.PriceListCode) || text(priceListForOutlet(outletCode)?.code)
  const price = seed.Price === undefined || seed.Price === null || seed.Price === ''
    ? toNumber(priceOf(seed.SKU, priceListCode))
    : toNumber(seed.Price)

  return resourceRow(RESOURCE_NAME, {
    Username: user.value?.name || '',
    Date: todayISO(),
    Reason: 'DAMAGE',
    InvoiceAdjustmentRequired: flag(true),
    InvoiceAdjustmentDone: 'FALSE',
    WarehouseActionRequired: flag(false),
    WarehouseActionCompleted: 'FALSE',
    Progress: SUBMITTED,
    Status: 'Active'
  }, parent, extra, { Price: Math.round(price * 100) / 100 })
}

export function returnsNode (records = [], options = {}) {
  const rows = (Array.isArray(records) ? records : []).map((row) => returnRow(row, options.extra))
  return {
    resource: RESOURCE_NAME,
    many: true,
    records: rows,
    permissions: { create: 'You are not allowed to log a return.' },
    successMsg: `${rows.length} return${rows.length === 1 ? '' : 's'} logged.`
  }
}

const PRICE_LIST_CONTROL = 'PriceListCode'
const PRICE_TOUCHED_CONTROL = 'PriceTouched'

const OUTLET_MOVEMENTS = 'OutletMovements'

const draftOf = (pageState) => asRow(pageState.getRecord(null, RESOURCE_NAME))
const setDraft = (pageState, key, value) => pageState.setRecord(key, value, RESOURCE_NAME)

function invoiceLineFor (invoiceCode, sku, excludeReturnCode = '') {
  const code = text(invoiceCode)
  if (!code) return null

  const recordSource = useRecord()
  const header = (recordSource.rows('OutletConsumptionInvoices') || [])
    .find((row) => text(row.Code) === code) || null

  let qty = 0
  let price = null
  for (const line of recordSource.rows('OutletConsumptionInvoiceItems') || []) {
    if (text(line.OutletConsumptionInvoiceCode) !== code) continue
    if (sku && text(line.SKU) !== text(sku)) continue
    qty += toNumber(line.Qty)
    if (price === null) price = toNumber(line.Price)
  }

  if (price === null) return null
  const { returnsOfInvoice } = useReturnResource()
  const returnedQty = returnsOfInvoice(code, { source: true })
    .filter((row) => text(row.SKU) === text(sku) && text(row.Code) !== text(excludeReturnCode))
    .reduce((sum, row) => sum + Math.abs(toNumber(row.Qty)), 0)
  return {
    qty,
    returnedQty,
    remainingQty: Math.max(0, qty - returnedQty),
    price,
    priceListCode: text(header?.PriceListCode)
  }
}

function repriceDraft (pageState) {
  const draft = draftOf(pageState)
  if (text(draft.SourceInvoiceCode)) return
  if (pageState.getControls(PRICE_TOUCHED_CONTROL, false, RESOURCE_NAME) === true) return

  const sku = text(draft.SKU)
  if (!sku) return

  const list = text(pageState.getControls(PRICE_LIST_CONTROL, '', RESOURCE_NAME))
  const price = list ? priceFromList(list, sku) : resolveReturnUnitPrice(draft.OutletCode, sku)
  setDraft(pageState, 'Price', toNumber(price))
}

function applyReturnOutlet (outletCode, pageState) {
  setDraft(pageState, 'SourceInvoiceCode', '')
  const list = effectivePriceListCode(outletCode)
  if (list) pageState.setControls(PRICE_LIST_CONTROL, list, RESOURCE_NAME)
  repriceDraft(pageState)
}

function applyReturnSku (sku, pageState) {
  setDraft(pageState, 'SourceInvoiceCode', '')
  repriceDraft(pageState)
}

export function applyReturnSourceInvoice (invoiceCode, pageState, excludeReturnCode = '') {
  if (!pageState) return
  const code = text(invoiceCode)

  if (!code) {
    setDraft(pageState, 'InvoiceAdjustmentRequired', flag(false))
    return
  }

  const line = invoiceLineFor(code, draftOf(pageState).SKU, excludeReturnCode)
  if (!line) return

  pageState.setRecord(null, {
    Qty: line.remainingQty,
    Price: line.price,
    InvoiceAdjustmentRequired: flag(true),
    InvoiceAdjustmentDone: flag(false)
  }, RESOURCE_NAME)

  pageState.setControls(PRICE_LIST_CONTROL, line.priceListCode, RESOURCE_NAME)
  pageState.setControls(PRICE_TOUCHED_CONTROL, false, RESOURCE_NAME)
}

function applyReturnInvoiceTrack (required, pageState) {
  if (!isFlagged(required)) setDraft(pageState, 'SourceInvoiceCode', '')
}

export function applyReturnWarehouseTrack (required, pageState) {
  if (!isFlagged(required)) {
    setDraft(pageState, 'WarehouseCode', '')
    return
  }
  if (text(draftOf(pageState).WarehouseCode)) return
  setDraft(pageState, 'WarehouseCode', text(useWarehouseResource().mainWarehouse.value?.code))
}

function syncReturnDraftProgress (pageState) {
  setDraft(pageState, 'Progress', deriveReturnProgress(draftOf(pageState)))
}

function syncReturnDraftMovement (pageState, stored = null) {
  const draft = draftOf(pageState)
  const was = asRow(stored)
  const editing = !!text(was.Code)
  const outletCode = text(draft.OutletCode) || text(was.OutletCode)
  const sku = text(draft.SKU)

  const qtyChange = returnQtyChange(draft.Qty, {
    invoiceRequired: isFlagged(draft.InvoiceAdjustmentRequired),
    warehouseRequired: isFlagged(draft.WarehouseActionRequired)
  }) - (editing ? storedQtyChange(was) : 0)

  if (!qtyChange || !outletCode || !sku) {
    pageState.removeNode(OUTLET_MOVEMENTS)
    return
  }

  pageState.applyNodes(buildOutletMovementNode(outletMovementRow({
    outletCode,
    storageName: draft.StorageName || was.StorageName,
    sku,
    qty: qtyChange,
    direction: shelfDirection(qtyChange),
    referenceType: OUTLET_REFERENCE.RETURN,
    referenceCode: editing ? text(was.Code) : batchRef(RETURN_REF_PATH),
    movementDate: editing ? todayISO() : (text(draft.Date) || todayISO())
  })))
}

function syncReturnActionProgress (pageState, stored) {
  const merged = { ...asRow(stored), ...draftOf(pageState) }
  setDraft(pageState, 'Progress', deriveReturnProgress(merged))
}

function warehouseStampPair (action, actorName) {
  const now = toDateTime24(new Date())
  const actor = text(actorName)
  return text(action) === DISPOSED
    ? { WarehouseActionDisposedAt: now, WarehouseActionDisposedBy: actor, WarehouseActionStockedAt: '', WarehouseActionStockedBy: '' }
    : { WarehouseActionStockedAt: now, WarehouseActionStockedBy: actor, WarehouseActionDisposedAt: '', WarehouseActionDisposedBy: '' }
}

function syncReturnStockMovement (pageState, stored) {
  const was = asRow(stored)
  const draft = draftOf(pageState)
  const stocksBackIn = text(draft.WarehouseAction) !== DISPOSED && text(was.WarehouseCode)

  if (!stocksBackIn) {
    pageState.removeNode(STOCK_MOVEMENTS)
    return
  }

  pageState.applyNodes(buildStockMovementNodes([stockMovementRow({
    warehouseCode: was.WarehouseCode,
    storageName: draft.StorageName,
    sku: was.SKU,
    qty: was.Qty,
    direction: INTO_WAREHOUSE,
    referenceType: STOCK_REFERENCE.RETURN,
    referenceCode: text(was.Code)
  })]))
}

export function returnDraftDerivations ({ movement = true, stored = null } = {}) {
  const on = (spec) => ({ ...spec, resource: RESOURCE_NAME })

  return [
    { key: 'returnAdd:outlet', on: on({ record: 'OutletCode' }), immediate: false, handler: applyReturnOutlet },
    { key: 'returnAdd:sku', on: on({ record: 'SKU' }), immediate: false, handler: applyReturnSku },
    { key: 'returnAdd:sourceInvoice', on: on({ record: 'SourceInvoiceCode' }), immediate: false,
      handler: (value, api) => applyReturnSourceInvoice(value, api, text(asRow(stored).Code)) },
    { key: 'returnAdd:priceList', on: on({ control: PRICE_LIST_CONTROL }), immediate: false, handler: (value, api) => repriceDraft(api) },
    { key: 'returnAdd:invoiceTrack', on: on({ record: 'InvoiceAdjustmentRequired' }), immediate: false, handler: applyReturnInvoiceTrack },
    { key: 'returnAdd:warehouseTrack', on: on({ record: 'WarehouseActionRequired' }), immediate: false, handler: applyReturnWarehouseTrack },
    ...(movement
      ? [{ key: 'returnAdd:record', on: on({ record: true }), immediate: false, handler: (value, api) => { syncReturnDraftProgress(api); syncReturnDraftMovement(api, stored) } }]
      : [{ key: 'returnAdd:record', on: on({ record: true }), immediate: false, handler: (value, api) => syncReturnDraftProgress(api) }])
  ]
}

export function validateReturnDraft (record = {}, { requireTrack = true, excludeCode = '' } = {}) {
  const entry = asRow(record)

  if (!text(entry.OutletCode)) return 'Outlet is required.'
  if (!text(entry.SKU)) return 'SKU is required.'
  const quantity = Math.abs(toNumber(entry.Qty))
  const invoiceCode = text(entry.SourceInvoiceCode)
  if (invoiceCode) {
    const line = invoiceLineFor(invoiceCode, entry.SKU, text(excludeCode) || text(entry.Code))
    if (!line) return 'The selected invoice does not include this item.'
    if (line.remainingQty <= 0) return 'This invoice line has no quantity left to return.'
    if (quantity > line.remainingQty) {
      return `Returned quantity exceeds the remaining invoice quantity (${line.remainingQty}).`
    }
  }
  if (quantity <= 0) return 'Returned quantity must be greater than 0.'
  if (requireTrack && !returnRequiresTrack(entry)) {
    return 'A return must either be credited on an invoice or move stock off the shelf.'
  }
  if (text(entry.Reason) === REASON_REQUIRING_COMMENT && !text(entry.ReasonComment)) {
    return 'Reason "Other" needs an explanation.'
  }
  if (isFlagged(entry.WarehouseActionRequired) && !text(entry.WarehouseCode)) {
    return 'Target warehouse is required when stock is leaving the outlet.'
  }
  return ''
}

export function buildReturnInitNodes ({ actorName = '', outletCode = '' } = {}) {
  const { user } = useAuth()

  return [{
    resource: RESOURCE_NAME,
    record: resourceRow(RESOURCE_NAME, {
      Date: todayISO(),
      Username: text(actorName) || text(user.value?.name || user.value?.email),
      OutletCode: text(outletCode),
      SKU: '',
      Reason: 'DAMAGE',
      ReasonComment: '',
      WarehouseCode: '',
      Qty: 1,
      WarehouseActionRequired: flag(true)
    }),
    controls: { [PRICE_LIST_CONTROL]: '', [PRICE_TOUCHED_CONTROL]: false },
    derive: returnDraftDerivations(),
    permissions: { create: 'You are not allowed to log a return.' }
  }]
}

export function buildReturnCreateNodes ({ form = {}, resolvedPrice = 0, actorName = '', requireTrack = true } = {}) {
  const entry = asRow(form)
  const outletCode = text(entry.OutletCode)
  const sku = text(entry.SKU)
  const qty = Math.abs(toNumber(entry.Qty))

  const problem = validateReturnDraft(entry, { requireTrack })
  if (problem) return [{ valid: false, message: problem }]

  const invoiceRequired = isFlagged(entry.InvoiceAdjustmentRequired)
  const warehouseRequired = isFlagged(entry.WarehouseActionRequired)

  const record = {
    OutletCode: outletCode,
    Date: text(entry.Date) || todayISO(),
    Username: text(entry.Username) || text(actorName),
    SKU: sku,
    Qty: qty,
    Price: Math.round(toNumber(resolvedPrice) * 100) / 100,
    Reason: text(entry.Reason) || 'DAMAGE',
    ReasonComment: text(entry.ReasonComment),
    InvoiceAdjustmentRequired: flag(invoiceRequired),
    InvoiceAdjustmentDone: 'FALSE',
    ConsumptionInvoiceCode: '',
    SourceInvoiceCode: invoiceRequired ? text(entry.SourceInvoiceCode) : '',
    WarehouseActionRequired: flag(warehouseRequired),
    WarehouseActionCompleted: 'FALSE',
    WarehouseCode: warehouseRequired ? text(entry.WarehouseCode) : '',
    WarehouseAction: '',
    WarehouseActionDisposedReason: '',
    Status: 'Active'
  }

  record.Progress = deriveReturnProgress(record)

  const nodes = [{ resource: RESOURCE_NAME, record: record, permissions: { create: 'You are not allowed to create this outlet return.' }}]

  const qtyChange = returnQtyChange(qty, { invoiceRequired, warehouseRequired })
  if (qtyChange !== 0) {
    nodes.push(buildOutletMovementNode(outletMovementRow({
      outletCode,
      storageName: entry.StorageName,
      sku,
      qty: qtyChange,
      direction: shelfDirection(qtyChange),
      referenceType: OUTLET_REFERENCE.RETURN,
      referenceCode: batchRef(RETURN_REF_PATH),
      movementDate: record.Date
    })))
  }

  return nodes
}

function storedPriceListCode (stored) {
  const row = asRow(stored)
  const fromInvoice = invoiceLineFor(row.SourceInvoiceCode, row.SKU)
  return text(fromInvoice?.priceListCode) || text(effectivePriceListCode(row.OutletCode))
}

export function buildReturnEditNodes ({ record = {} } = {}) {
  const stored = asRow(record)
  const code = text(stored.Code)

  if (!code) return [{ valid: false, message: 'Return code is missing.' }]
  if (!isEditable(stored)) {
    return [{ valid: false, message: 'This return can no longer be edited. Cancel and re-log it instead.' }]
  }

  return [{
    resource: RESOURCE_NAME,
    code: textOrRef(code),
    record: { ...withoutAudit(resourceRow(RESOURCE_NAME, stored)), Progress: deriveReturnProgress(stored) },
    controls: { [PRICE_LIST_CONTROL]: storedPriceListCode(stored), [PRICE_TOUCHED_CONTROL]: true },
    derive: returnDraftDerivations({ stored }),
    reload: ['OutletStorages'],
    permissions: { update: 'You are not allowed to update this outlet return.' },
    successMsg: `Return ${code} updated.`
  }]
}

export function buildReturnBulkCreateNodes ({ lines = [], actorName = '', movementDate = '' } = {}) {
  const entries = asList(lines).map(asRow).filter((line) => text(asRow(line.form).SKU))
  if (!entries.length) return []

  const records = []
  const movements = []

  for (const line of entries) {
    const returnIndex = records.length
    const built = buildReturnCreateNodes({
      form: line.form,
      resolvedPrice: line.resolvedPrice,
      actorName,
      requireTrack: false
    })
    if (built[0]?.valid === false) return built

    for (const node of built) {
      if (node.resource === RESOURCE_NAME) records.push(node.record)
      else movements.push({
        ...node.record,
        ReferenceCode: batchRef(`${RESOURCE_NAME}.records.${returnIndex}.Code`),
        MovementDate: text(movementDate) || node.record.MovementDate
      })
    }
  }

  const nodes = [{ resource: RESOURCE_NAME, many: true, records: records, permissions: { create: 'You are not allowed to create this outlet return.' }}]
  nodes.push(...buildOutletMovementNodes(movements))

  return nodes
}

export function buildReturnWarehouseActionInitNodes ({ record = {}, actorName = '' } = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return [{ valid: false, message: 'Return code is missing.' }]
  if (isCancelled(row)) return [{ valid: false, message: 'A cancelled return cannot be actioned.' }]
  if (!warehouseActionRequired(row)) return [{ valid: false, message: 'This return has no warehouse action to confirm.' }]
  if (warehouseActionCompleted(row)) return [{ valid: false, message: 'The warehouse action is already confirmed.' }]

  const update = {
    WarehouseActionCompleted: 'TRUE',
    WarehouseAction: STOCKED,
    WarehouseActionDisposedReason: '',
    StorageName: DEFAULT_STORAGE,
    ...warehouseStampPair(STOCKED, actorName)
  }
  update.Progress = deriveReturnProgress({ ...row, ...update })

  const on = (spec) => ({ ...spec, resource: RESOURCE_NAME })

  const nodes = [{
    resource: RESOURCE_NAME,
    code: textOrRef(code),
    record: update,
    reload: ['WarehouseStorages'],
    derive: [
      { key: 'returnWa:disposition', on: on({ record: 'WarehouseAction' }), immediate: false,
        handler: (action, api) => api.setRecord(null, warehouseStampPair(action, actorName), RESOURCE_NAME) },
      { key: 'returnWa:record', on: on({ record: true }), immediate: false,
        handler: (value, api) => { syncReturnActionProgress(api, row); syncReturnStockMovement(api, row) } }
    ],
    permissions: { warehouseAction: 'You are not allowed to warehouse action this outlet return.' },
    successMsg: 'Warehouse action confirmed.'
  }]

  if (text(row.WarehouseCode)) {
    nodes.push(...buildStockMovementNodes([stockMovementRow({
      warehouseCode: row.WarehouseCode,
      storageName: DEFAULT_STORAGE,
      sku: row.SKU,
      qty: row.Qty,
      direction: INTO_WAREHOUSE,
      referenceType: STOCK_REFERENCE.RETURN,
      referenceCode: code
    })]))
  }

  return nodes
}

export function validateReturnWarehouseActionDraft (draft = {}) {
  const entry = asRow(draft)
  if (text(entry.WarehouseAction) === DISPOSED && !text(entry.WarehouseActionDisposedReason)) {
    return 'A disposal reason is required when writing stock off.'
  }
  return ''
}

export function buildReturnMarkInvoiceAdjustedInitNodes ({ record = {} } = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return [{ valid: false, message: 'Return code is missing.' }]
  if (isCancelled(row)) return [{ valid: false, message: 'A cancelled return cannot be settled.' }]
  if (!invoiceAdjustmentRequired(row)) return [{ valid: false, message: 'This return needs no invoice adjustment.' }]
  if (isFlagged(row.InvoiceAdjustmentDone)) return [{ valid: false, message: 'The invoice adjustment is already settled.' }]

  const update = { InvoiceAdjustmentDone: 'TRUE', ConsumptionInvoiceCode: '' }
  update.Progress = deriveReturnProgress({ ...row, ...update })

  return [{
    resource: RESOURCE_NAME,
    code: textOrRef(code),
    record: update,
    derive: [{
      key: 'returnSettle:record',
      on: { resource: RESOURCE_NAME, record: true },
      immediate: false,
      handler: (value, api) => syncReturnActionProgress(api, row)
    }],
    permissions: { markInvoiceAdjusted: 'You are not allowed to mark invoice adjusted this outlet return.' }
  }]
}

export function buildReturnInvoiceAdjustmentLinkedNodes ({ returnRows = [], invoiceCode = null, actorName = '' } = {}) {
  const rows = asList(returnRows).map(asRow).filter((row) => text(row.Code))
  if (!rows.length) return []

  const records = rows.map((row) => {
    const update = {
      Code: text(row.Code),
      InvoiceAdjustmentDone: 'TRUE',
      ConsumptionInvoiceCode: textOrRef(invoiceCode)
    }
    update.Progress = deriveReturnProgress({ ...row, ...update })
    return update
  })

  return [
    { resource: RESOURCE_NAME, many: true, records: records, permissions: { update: 'You are not allowed to update this outlet return.' }, successMsg: `${rows.length} return${rows.length === 1 ? '' : 's'} credited.` }
  ]
}

export function buildReturnInvoiceCreditReversalNodes ({ returnRows = [] } = {}) {
  const rows = asList(returnRows).map(asRow)
    .filter((row) => text(row.Code) && !isCancelled(row))
  if (!rows.length) return []

  return [
    { resource: RESOURCE_NAME, many: true, records: rows.map((row) => {
      const update = { Code: text(row.Code), InvoiceAdjustmentDone: 'FALSE', ConsumptionInvoiceCode: '' }
      update.Progress = deriveReturnProgress({ ...row, ...update })
      return update
    }), permissions: { update: 'You are not allowed to update this outlet return.' }, successMsg: `${rows.length} return credit${rows.length === 1 ? '' : 's'} reversed.` }
  ]
}

export function buildReturnCancelInitNodes ({ record = {}, reason = '', role = '' } = {}) {
  const row = asRow(record)
  const code = text(row.Code)
  const at = text(role) ? { role: text(role) } : {}

  if (!code) return [{ valid: false, message: 'Return code is missing.' }]
  if (isCancelled(row)) return [{ valid: false, message: 'This return is already cancelled.' }]

  const nodes = [{
    resource: RESOURCE_NAME,
    ...at,
    code: textOrRef(code),
    record: { Progress: CANCELLED, ReasonComment: text(reason) || text(row.ReasonComment) },
    reload: ['OutletStorages'],
    permissions: { Cancel: 'You are not allowed to cancel this outlet return.' },
    successMsg: `Return ${code} cancelled.`
  }]

  const reversal = -storedQtyChange(row)
  if (reversal !== 0) {
    nodes.push({ ...buildOutletMovementNode(outletMovementRow({
      outletCode: row.OutletCode,
      storageName: row.StorageName,
      sku: row.SKU,
      qty: reversal,
      direction: shelfDirection(reversal),
      referenceType: OUTLET_REFERENCE.RETURN,
      referenceCode: code,
      movementDate: todayISO()
    })), ...at })
  }

  return nodes
}

export function validateReturnCancelDraft (draft = {}) {
  return text(asRow(draft).ReasonComment) ? '' : 'A cancellation reason is required.'
}

export function useReturnPayload () {
  return {
    RETURN_REF_PATH,
    returnRow,
    returnsNode,
    returnQtyChange,
    storedQtyChange,
    buildReturnInitNodes,
    returnDraftDerivations,
    validateReturnDraft,
    applyReturnWarehouseTrack,
    applyReturnSourceInvoice,
    buildReturnCreateNodes,
    buildReturnEditNodes,
    buildReturnBulkCreateNodes,
    buildReturnWarehouseActionInitNodes,
    validateReturnWarehouseActionDraft,
    buildReturnMarkInvoiceAdjustedInitNodes,
    buildReturnInvoiceAdjustmentLinkedNodes,
    buildReturnInvoiceCreditReversalNodes,
    buildReturnCancelInitNodes,
    validateReturnCancelDraft
  }
}
