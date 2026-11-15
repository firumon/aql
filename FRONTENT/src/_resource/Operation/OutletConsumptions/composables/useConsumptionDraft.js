import { useRecord } from 'src/composables/resources/useRecord'
import { useAuth } from 'src/composables/core/useAuth'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { toNumber, countRowsOf, positiveRows } from './useConsumptionStock'
import { consumptionCompositeNode, buildConsumptionMovementsNode } from './useConsumptionPayload'
import { buildConsumptionWorkflowChainNodes, RETURN_ADJUSTMENT_ROLE } from './useConsumptionWorkflow'
import { makeLineTaxResolver } from './useConsumptionInvoice'
import { returnsNode } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { RESTOCK_CONTROL, restockNode } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { buildRestockMovementNodes } from 'src/_resource/Operation/OutletRestocks/composables/useRestockCreation'
import {
  INVOICE_DOCUMENT_COMPANIONS,
  invoiceNodeForConsumption,
  makeInvoiceLinePriceResolver
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { OUTLET_ROLE } from 'src/_resource/Operation/OutletMovements/composables/useOutletMovementPayload'
import { visitFrequencyFor, visitDateFrom } from 'src/_resource/Operation/OutletVisits/composables/useVisitCadence'
import { useOutletStorageResource } from 'src/_resource/Operation/OutletStorages/composables/useOutletStorageResource'

const CONSUMPTIONS = 'OutletConsumptions'
const CONSUMPTION_ITEMS = 'OutletConsumptionItems'
const INVOICES = 'OutletConsumptionInvoices'
const INVOICE_ITEMS = 'OutletConsumptionInvoiceItems'
const OUTLET_MOVEMENTS = 'OutletMovements'
const VISITS = 'OutletVisits'
const RESTOCKS = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'
const RETURNS = 'OutletReturns'
const STOCK_MOVEMENTS = 'StockMovements'

export const CONSUMPTION_ROLE = { NEXT: 'next' }

export const CONSUMPTION_CONTROL = {
  INVOICING: { header: 'invoicing' },
  RESTOCKING: { header: 'restocking' },
  DIRECT_RESTOCK: { header: RESTOCK_CONTROL.DIRECT, resource: RESTOCKS },
  WAREHOUSE: { header: RESTOCK_CONTROL.WAREHOUSE, resource: RESTOCKS },
  MARK_DELIVERED: { header: RESTOCK_CONTROL.DELIVER, resource: RESTOCKS },
  DISCOUNT_TYPE: { header: 'DiscountType', resource: INVOICES },
  DISCOUNT_VALUE: { header: 'DiscountValue', resource: INVOICES },
  INVOICE_COMMENT: { header: 'InvoiceComment', resource: INVOICES },
  ADJUSTED_RETURNS: { header: 'AdjustedReturnCodes' },
  COMPLETE_VISIT: { header: 'CompleteVisit' },
  SCHEDULE_NEXT: { header: 'ScheduleNextVisit' },
  NEXT_VISIT_DAYS: { header: 'NextVisitDays' },
  NEXT_VISIT_COMMENT: { header: 'NextVisitComment' }
}

export const VISIT_COMPLETE_COMMENT = 'Completed along with consumption'

export const VISIT_COMPLETE_COMMENT_FIELD = 'ProgressCompletedComment'

export const CHAIN_SUCCESS = 'ChainSuccessMsg'
export const CHAIN_OUTCOME = 'ChainOutcome'

export const CHAIN_BLOCK = 'ChainBlock'

const CTL = CONSUMPTION_CONTROL

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const unset = (value) => value === null || value === undefined || value === ''
const isTrue = (value) => text(value).toUpperCase() === 'TRUE'

const getCtl = (pageState, ctl, fallback = null) =>
  pageState.getControls(ctl.header, fallback, ctl.resource)

const storeRows = (name) => useRecord().rows(name) || []

const allowedTo = (resource, action) => useResourceConfig(resource).allowed(action) === true

const soldItemsOf = (pageState) =>
  positiveRows(pageState.getChildRows(CONSUMPTION_ITEMS, CONSUMPTIONS))

const returnItemsOf = (pageState) =>
  positiveRows(pageState.getRecordRows(RETURNS))

const restockItemsOf = (pageState) =>
  positiveRows(pageState.getChildRows(RESTOCK_ITEMS, RESTOCKS), 'Quantity')

function returnMetaFrom (row) {
  return {
    Reason: text(row?.Reason) || 'DAMAGE',
    ReasonComment: text(row?.ReasonComment),
    SourceInvoiceCode: text(row?.SourceInvoiceCode),
    Price: unset(row?.Price) ? null : toNumber(row.Price),
    InvoiceAdjustmentRequired: isTrue(row?.InvoiceAdjustmentRequired),
    WarehouseActionRequired: isTrue(row?.WarehouseActionRequired),
    WarehouseCode: text(row?.WarehouseCode)
  }
}

export function nextVisitPlan (pageState, operatingRules = []) {
  const record = pageState.getRecord(null, CONSUMPTIONS) || {}
  const outletCode = text(record.OutletCode)
  const base = text(record.Date) || new Date().toISOString().slice(0, 10)

  const frequency = visitFrequencyFor(outletCode, operatingRules)
  const storedDays = getCtl(pageState, CTL.NEXT_VISIT_DAYS)
  const days = unset(storedDays) ? num(frequency) : num(storedDays)

  const storedComment = getCtl(pageState, CTL.NEXT_VISIT_COMMENT)
  const comment = storedComment === null
    ? `Planned after consumption on ${base}`
    : text(storedComment)

  const date = days > 0 ? visitDateFrom(base, days) : ''
  const wanted = getCtl(pageState, CTL.SCHEDULE_NEXT, true) === true

  return { outletCode, base, frequency, days, date, comment, wanted, willSchedule: wanted && !!date }
}

function chainInputs (pageState) {
  const form = pageState.getRecord(null, CONSUMPTIONS) || {}
  const outletStorages = storeRows('OutletStorages')
  const invoiceRecord = pageState.getRecord(null, INVOICES) || {}
  const priceListCode = text(invoiceRecord.PriceListCode)
  const resolvePrice = makeInvoiceLinePriceResolver(pageState.getChildRows(INVOICE_ITEMS, INVOICES))

  const sold = soldItemsOf(pageState)
  const returned = returnItemsOf(pageState)
  const returnBySku = new Map(returned.map((row) => [text(row.SKU), row]))

  const restocking = pageState.hasNode(RESTOCKS) && getCtl(pageState, CTL.RESTOCKING, true) === true
  const directRestock = restocking && getCtl(pageState, CTL.DIRECT_RESTOCK, false) === true
  const plan = nextVisitPlan(pageState, storeRows('OutletOperatingRules'))
  const completingVisit = getCtl(pageState, CTL.COMPLETE_VISIT, true) === true &&
    !!text(form.OutletVisitCode)

  return {
    form,
    countRows: countRowsOf(sold, returned, outletStorages, text(form.OutletCode)),
    actorName: text(form.Username),
    outletStorages,
    warehouseStorages: storeRows('WarehouseStorages'),
    operatingRules: storeRows('OutletOperatingRules'),
    returnRows: storeRows('OutletReturns'),
    returnMetaOf: (sku) => returnMetaFrom(returnBySku.get(text(sku))),
    adjustedReturnCodes: (getCtl(pageState, CTL.ADJUSTED_RETURNS, []) || []).map(text).filter(Boolean),
    generateInvoice: pageState.hasNode(INVOICES) && getCtl(pageState, CTL.INVOICING, true) === true,
    priceListCode,
    dueDate: text(invoiceRecord.DueDate),
    discountType: text(getCtl(pageState, CTL.DISCOUNT_TYPE)) || 'FLAT',
    discountValue: toNumber(getCtl(pageState, CTL.DISCOUNT_VALUE, 0)),
    invoiceComment: text(getCtl(pageState, CTL.INVOICE_COMMENT)),
    calculateLineTax: makeLineTaxResolver({ priceListCode, resolvePrice }),
    resolvePrice,
    restockRows: restocking ? restockItemsOf(pageState) : [],
    directRestock,
    warehouseCode: directRestock ? text(getCtl(pageState, CTL.WAREHOUSE)) : '',
    markDelivered: directRestock && getCtl(pageState, CTL.MARK_DELIVERED, false) === true,
    completeVisit: completingVisit,
    completeComment: text(pageState.getActions(
      'Complete', `fields.${VISIT_COMPLETE_COMMENT_FIELD}`, VISITS)) || VISIT_COMPLETE_COMMENT,
    scheduleNext: plan.willSchedule,
    nextVisit: pageState.hasNode(VISITS, CONSUMPTION_ROLE.NEXT)
      ? (pageState.getRecord(null, VISITS, CONSUMPTION_ROLE.NEXT) || {})
      : {
          OutletCode: text(form.OutletCode),
          Date: plan.date,
          ProgressPlannedComment: plan.comment,
          Username: text(form.Username)
        },
    nextVisitDays: plan.days
  }
}

export function applyConsumptionOutlet (outletCode, pageState) {
  const code = text(outletCode)
  if (!code) return
  const lines = positiveRows(useOutletStorageResource().stockRowsOf(code), 'Quantity')
    .map((row) => ({ SKU: text(row.SKU), Qty: 0 }))

  pageState.applyNodes(consumptionCompositeNode({ ...(pageState.getRecord(null, CONSUMPTIONS) || {}) }, lines))
  pageState.removeNode(RETURNS)
  pageState.removeNode(OUTLET_MOVEMENTS)
  pageState.removeNode(RETURNS, RETURN_ADJUSTMENT_ROLE)
  chainDigests.delete(pageState)
  pageState.removeNode(RESTOCKS)
}

function syncInvoiceNode (pageState) {
  const wanted = getCtl(pageState, CTL.INVOICING, true) === true && allowedTo(INVOICES, 'create')
  const sold = soldItemsOf(pageState)
  if (!wanted || !sold.length) return dropInvoiceNodes(pageState)
  if (!pageState.hasNode(INVOICES)) seedConsumptionInvoice(pageState, sold)
}

export function dropInvoiceNodes (pageState) {
  pageState.removeNode(INVOICES)
  pageState.removeNode(RETURNS, RETURN_ADJUSTMENT_ROLE)
  for (const at of INVOICE_DOCUMENT_COMPANIONS) pageState.removeNode(at.resource, at.role)
}

function enforceToggles (pageState) {
  syncInvoiceNode(pageState)
  if (getCtl(pageState, CTL.RESTOCKING, true) !== true) pageState.removeNode(RESTOCKS)
  const completing = getCtl(pageState, CTL.COMPLETE_VISIT, true) === true &&
    !!text(pageState.getRecord('OutletVisitCode', CONSUMPTIONS))
  if (!completing) pageState.excludeAdditionalAction('Complete', { resource: VISITS })
}

function syncLedgerNodes (pageState) {
  const form = pageState.getRecord(null, CONSUMPTIONS) || {}
  const outletCode = text(form.OutletCode)

  const apply = (resource, role, node) => {
    if (node) pageState.applyNodes([node])
    else pageState.removeNode(resource, role)
  }

  const countRows = countRowsOf(soldItemsOf(pageState), returnItemsOf(pageState),
    storeRows('OutletStorages'), outletCode)
  apply(OUTLET_MOVEMENTS, OUTLET_ROLE.SALE,
    outletCode ? buildConsumptionMovementsNode(form, countRows) : null)

  const items = restockItemsOf(pageState)
  const restocking = pageState.hasNode(RESTOCKS) && getCtl(pageState, CTL.RESTOCKING, true) === true

  const movements = restocking && outletCode && items.length
    ? buildRestockMovementNodes({
      outletCode,
      warehouseCode: text(getCtl(pageState, CTL.WAREHOUSE, '')),
      date: text(form.Date),
      items,
      direct: getCtl(pageState, CTL.DIRECT_RESTOCK, false) === true,
      deliver: getCtl(pageState, CTL.MARK_DELIVERED, false) === true
    })
    : []

  apply(STOCK_MOVEMENTS, null, movements.find((node) => node.resource === STOCK_MOVEMENTS) || null)
  apply(OUTLET_MOVEMENTS, OUTLET_ROLE.DELIVERY,
    movements.find((node) => node.resource === OUTLET_MOVEMENTS) || null)
}

const WORKFLOW_STAMP_KEY = /^Progress[A-Za-z]*(At|By|Comment)$/

const chainDigests = new WeakMap()

export function syncConsumptionChain (pageState) {
  enforceToggles(pageState)
  const returned = returnItemsOf(pageState)
  if (!returned.length) pageState.removeNode(OUTLET_MOVEMENTS)
  if (!soldItemsOf(pageState).length && !returned.length) {
    chainDigests.delete(pageState)
    return
  }

  const args = chainInputs(pageState)
  const digest = JSON.stringify({ args, returned }, (key, value) => {
    if (typeof value === 'function') return undefined
    if (WORKFLOW_STAMP_KEY.test(key)) return undefined
    return value
  })
  if (digest === chainDigests.get(pageState)) return

  const nodes = buildConsumptionWorkflowChainNodes({ ...args, draft: true })
  if (!Array.isArray(nodes) || nodes.some((node) => node?.valid === false)) return

  const { chainBlock = '', ...first } = nodes[0] || {}
  const applied = pageState.applyNodes(nodes.length ? [first, ...nodes.slice(1)] : nodes)
  if (applied.valid === false) return
  chainDigests.set(pageState, digest)
  const hasReturnMovements = nodes.some((node) => node.resource === OUTLET_MOVEMENTS && !node.role)
  if (!hasReturnMovements) pageState.removeNode(OUTLET_MOVEMENTS)
  const hasReturnAdjustments = nodes.some((node) => node.resource === RETURNS && node.role === RETURN_ADJUSTMENT_ROLE)
  if (!hasReturnAdjustments) pageState.removeNode(RETURNS, RETURN_ADJUSTMENT_ROLE)

  if (!soldItemsOf(pageState).length) pageState.removeNode(CONSUMPTIONS)
  enforceToggles(pageState)

  pageState.setControls(CHAIN_SUCCESS, applied.successMsg || 'Consumption recorded.')
  pageState.setControls(CHAIN_OUTCOME, applied.outcome || null)
  pageState.setControls(CHAIN_BLOCK, chainBlock)
}

export function consumptionDraftDerivations () {
  const chain = (value, api) => syncConsumptionChain(api)
  const both = (value, api) => { syncLedgerNodes(api); syncConsumptionChain(api) }

  return [
    { key: 'consumptionAdd:outlet', on: { resource: CONSUMPTIONS, record: 'OutletCode' }, immediate: true, handler: applyConsumptionOutlet },
    { key: 'consumptionAdd:seedToggles', on: { resource: CONSUMPTIONS, record: true }, immediate: true, handler: (value, api) => seedConsumptionToggles(api) },

    { key: 'consumptionAdd:soldLines', on: { resource: CONSUMPTIONS, children: true }, handler: both },
    { key: 'consumptionAdd:returns', on: { resource: RETURNS, records: true }, handler: both },
    { key: 'consumptionAdd:restockItems', on: { resource: RESTOCKS, children: true }, handler: both },
    { key: 'consumptionAdd:restocking', on: { control: CTL.RESTOCKING.header }, handler: both },
    { key: 'consumptionAdd:directRestock', on: { resource: RESTOCKS, control: RESTOCK_CONTROL.DIRECT }, handler: both },
    { key: 'consumptionAdd:markDelivered', on: { resource: RESTOCKS, control: RESTOCK_CONTROL.DELIVER }, handler: both },
    { key: 'consumptionAdd:warehouse', on: { resource: RESTOCKS, control: RESTOCK_CONTROL.WAREHOUSE }, handler: both },

    { key: 'consumptionAdd:header', on: { resource: CONSUMPTIONS, record: true }, handler: chain },
    { key: 'consumptionAdd:invoicing', on: { control: CTL.INVOICING.header }, handler: chain },
    { key: 'consumptionAdd:invoice', on: { resource: INVOICES, record: true }, handler: chain },
    { key: 'consumptionAdd:invoiceItems', on: { resource: INVOICES, children: true }, handler: chain },
    { key: 'consumptionAdd:discountType', on: { resource: INVOICES, control: CTL.DISCOUNT_TYPE.header }, handler: chain },
    { key: 'consumptionAdd:discountValue', on: { resource: INVOICES, control: CTL.DISCOUNT_VALUE.header }, handler: chain },
    { key: 'consumptionAdd:invoiceComment', on: { resource: INVOICES, control: CTL.INVOICE_COMMENT.header }, handler: chain },
    { key: 'consumptionAdd:restock', on: { resource: RESTOCKS, record: true }, handler: chain },
    { key: 'consumptionAdd:completeVisit', on: { control: CTL.COMPLETE_VISIT.header }, handler: chain },
    { key: 'consumptionAdd:scheduleNext', on: { control: CTL.SCHEDULE_NEXT.header }, handler: chain },
    { key: 'consumptionAdd:nextVisitDays', on: { control: CTL.NEXT_VISIT_DAYS.header }, handler: chain },
    { key: 'consumptionAdd:nextVisitComment', on: { control: CTL.NEXT_VISIT_COMMENT.header }, handler: chain }
  ]
}

function seedConsumptionToggles (pageState) {
  if (getCtl(pageState, CTL.INVOICING) === null) {
    pageState.setControls(CTL.INVOICING.header, allowedTo(INVOICES, 'create'))
  }
  if (getCtl(pageState, CTL.RESTOCKING) === null) {
    pageState.setControls(CTL.RESTOCKING.header, allowedTo(RESTOCKS, 'create'))
  }
}

export function buildConsumptionInitNodes ({ outletCode = '', visitCode = '', actorName = '' } = {}) {
  const { user } = useAuth()

  return [consumptionCompositeNode({
    OutletCode: text(outletCode),
    OutletVisitCode: text(visitCode),
    Username: text(actorName) || text(user.value?.name || user.value?.email)
  }, [])]
}

export function validateConsumptionDraft (pageState) {
  if (!soldItemsOf(pageState).length) {
    return 'No any items sold to proceed ..'
  }
  return text(pageState.getControls(CHAIN_BLOCK, ''))
}

function restockControlsOf (pageState) {
  return {
    [RESTOCK_CONTROL.DIRECT]: getCtl(pageState, CTL.DIRECT_RESTOCK, false) === true,
    [RESTOCK_CONTROL.DELIVER]: getCtl(pageState, CTL.MARK_DELIVERED, false) === true,
    [RESTOCK_CONTROL.WAREHOUSE]: text(getCtl(pageState, CTL.WAREHOUSE))
  }
}

export function settleConsumptionCount (pageState) {
  const sold = soldItemsOf(pageState)
  const returned = returnItemsOf(pageState)
  const restocks = restockItemsOf(pageState)

  pageState.setResource(CONSUMPTIONS, null,
    consumptionCompositeNode({ ...(pageState.getRecord(null, CONSUMPTIONS) || {}) }, sold))

  if (restocks.length) {
    pageState.setResource(RESTOCKS, null,
      restockNode({ ...(pageState.getRecord(null, RESTOCKS) || {}) }, restocks,
        restockControlsOf(pageState), { withDerive: false }))
  } else {
    pageState.removeNode(RESTOCKS)
  }

  if (returned.length) pageState.setResource(RETURNS, null, returnsNode(returned))
  else {
    pageState.removeNode(RETURNS)
    pageState.removeNode(OUTLET_MOVEMENTS)
  }
  chainDigests.delete(pageState)

  return { sold, returned, restocks }
}

export function seedConsumptionInvoice (pageState, sold) {
  const node = invoiceNodeForConsumption(
    pageState.getRecord(null, CONSUMPTIONS),
    sold,
    {
      existing: pageState.getRecord(null, INVOICES) || {},
      resolvePrice: makeInvoiceLinePriceResolver(pageState.getChildRows(INVOICE_ITEMS, INVOICES))
    })
  if (node) pageState.setResource(INVOICES, null, node)
  return !!node
}

export function settleConsumptionRestock (pageState) {
  if (getCtl(pageState, CTL.RESTOCKING, true) !== true) return pageState.removeNode(RESTOCKS)
  const kept = restockItemsOf(pageState)
  if (!kept.length) return pageState.removeNode(RESTOCKS)
  pageState.setResource(RESTOCKS, null, restockNode(
    { ...(pageState.getRecord(null, RESTOCKS) || {}) }, kept, restockControlsOf(pageState), { withDerive: false }))
}

export function hasPendingConsumptionReturns (outletCode) {
  return storeRows('OutletReturns').some((row) =>
    text(row?.OutletCode) === text(outletCode) &&
    text(row?.Status || 'Active') === 'Active' &&
    isTrue(row?.InvoiceAdjustmentRequired) &&
    !isTrue(row?.InvoiceAdjustmentDone))
}

export const consumptionInvoicingAllowed = () => allowedTo(INVOICES, 'create')
export const consumptionRestockingAllowed = () => allowedTo(RESTOCKS, 'create')
export const consumptionSoldItems = soldItemsOf
export const consumptionReturnItems = returnItemsOf
export const consumptionRestockItems = restockItemsOf

export function useConsumptionDraft () {
  return {
    CONSUMPTION_ROLE,
    CONSUMPTION_CONTROL,
    CHAIN_SUCCESS,
    CHAIN_OUTCOME,
    CHAIN_BLOCK,
    buildConsumptionInitNodes,
    consumptionDraftDerivations,
    validateConsumptionDraft,
    syncConsumptionChain,
    nextVisitPlan,
    applyConsumptionOutlet,
    settleConsumptionCount,
    seedConsumptionInvoice,
    settleConsumptionRestock,
    dropInvoiceNodes,
    hasPendingConsumptionReturns
  }
}
