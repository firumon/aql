import {
  buildVisitCompletionChainNodes,
  buildNextVisitChainNodes
} from 'src/_resource/Operation/OutletVisits/composables/useVisitPayload'
import { buildRestockChainNodes } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { toNumber, soldRowsOf, returnRowsOf, validateConsumption } from './useConsumptionStock'
import {
  consumptionCompositeNode,
  buildConsumptionMovementsNode,
  buildReturnsNodes,
  buildReturnAdjustmentNodes,
  buildInvoiceNodes
} from './useConsumptionPayload'

const CONSUMPTIONS = 'OutletConsumptions'
const RESTOCKS = 'OutletRestocks'
const RETURNS = 'OutletReturns'
export const RETURN_ADJUSTMENT_ROLE = 'invoiceAdjustment'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])

export function buildConsumptionWorkflowChainNodes ({
  form = {},
  countRows = [],
  actorName = '',
  outletStorages = [],
  warehouseStorages = [],
  operatingRules = [],
  returnMetaOf = () => ({}),
  returnRows = [],
  adjustedReturnCodes = [],
  generateInvoice = true,
  priceListCode = '',
  dueDate = '',
  discountType = 'FLAT',
  discountValue = 0,
  invoiceComment = '',
  calculateLineTax = null,
  resolvePrice = null,
  restockRows = [],
  directRestock = false,
  warehouseCode = '',
  markDelivered = false,
  completeVisit = true,
  completeComment = '',
  scheduleNext = true,
  nextVisitDays = null,
  nextVisit = {},
  draft = false
} = {}) {
  const entry = asRow(form)
  const sold = soldRowsOf(countRows)
  const returns = returnRowsOf(countRows)
  const hasSold = sold.length > 0
  const hasReturns = returns.length > 0
  const invoicing = hasSold && generateInvoice === true

  const blocks = []
  const block = (message, veto) => {
    blocks.push(message)
    return draft ? null : (veto || [{ valid: false, message }])
  }

  const check = validateConsumption(entry, countRows, outletStorages, {
    generateInvoice: invoicing,
    priceListCode,
    resolvePrice,
    directRestock: directRestock === true,
    warehouseCode,
    returnMetaOf,
    restockRows,
    submitting: true
  })
  if (!check.valid) {
    const stop = block(check.errors[0])
    if (stop) return stop
  }

  const adjustedCodes = asList(adjustedReturnCodes).map(text).filter(Boolean)
  const completingVisit = completeVisit === true && !!text(entry.OutletVisitCode)

  const nodes = []
  let wroteReturns = false
  let wroteConsumption = false
  let wroteRestock = false

  if (hasReturns) {
    const built = buildReturnsNodes(entry, countRows, returnMetaOf, { priceListCode })
    if (built[0]?.valid === false) {
      const stop = block(built[0].message || 'Return lines could not be built.', built)
      if (stop) return stop
    } else {
      wroteReturns = true
      nodes.push(...built)
    }
  }

  if (hasSold) {
    wroteConsumption = true
    nodes.push(consumptionCompositeNode(entry, sold.map((row) => ({
      SKU: text(row.SKU),
      Qty: toNumber(row.SoldQty),
      Status: 'Active'
    })), { actorName, generateInvoice: invoicing }))

    const movements = buildConsumptionMovementsNode(entry, countRows)
    if (movements) nodes.push(movements)
  }

  if (invoicing) {
    const invoice = buildInvoiceNodes(entry, sold, {
      priceListCode,
      dueDate: text(dueDate),
      returnDeduction: returnDeductionOf(returnRows, adjustedCodes),
      discountType: text(discountType) || 'FLAT',
      discountValue: Number(discountValue) || 0,
      invoiceComment: text(invoiceComment),
      returnCodes: adjustedCodes,
      actorName,
      calculateLineTax,
      resolvePrice
    })
    if (!invoice.length) {
      const stop = block('Nothing on this invoice can be priced — check the price list.')
      if (stop) return stop
    } else {
      nodes.push(...invoice)
      if (adjustedCodes.length) {
        const selected = asList(returnRows).map(asRow).filter((row) => adjustedCodes.includes(text(row.Code)))
        nodes.push(...buildReturnAdjustmentNodes(selected).map((node) => ({ ...node, role: RETURN_ADJUSTMENT_ROLE })))
      }
    }
  }

  const plansOnCompletion = completingVisit && scheduleNext === true
  if (completingVisit) {
    const completion = buildVisitCompletionChainNodes({
      visitCode: entry.OutletVisitCode,
      actorName,
      comment: text(completeComment),
      nextVisit: plansOnCompletion ? nextVisit : {},
      refresh: false
    })
    if (completion[0]?.valid === false) {
      const stop = block(completion[0].message || 'This visit cannot be completed.', completion)
      if (stop) return stop
    } else nodes.push(...completion)
  }
  if (scheduleNext === true && !plansOnCompletion) {
    const next = buildNextVisitChainNodes({
      form: entry, frequencyDays: nextVisitDays, operatingRules, actorName, visit: nextVisit, refresh: false })
    if (next[0]?.valid === false) {
      const stop = block(next[0].message || 'The next visit cannot be planned.', next)
      if (stop) return stop
    } else nodes.push(...next)
  }

  const restock = buildRestockChainNodes({
    form: entry,
    lines: restockRows,
    mode: directRestock === true ? 'DIRECT' : 'PENDING_APPROVAL',
    warehouseCode,
    warehouseStorages,
    markDelivered: markDelivered === true,
    linkToConsumption: hasSold,
    actorName
  })
  if (restock[0]?.valid === false) {
    const stop = block(restock[0].message || 'This restock cannot be raised.', restock)
    if (stop) return stop
  } else if (restock.length) {
    wroteRestock = true
    nodes.push(...restock)
  }

  if (!nodes.length) {
    const stop = block('This visit recorded nothing to submit.')
    if (stop) return stop
    return []
  }

  nodes.push({ resource: '$batch', reload: ['OutletStorages', 'WarehouseStorages', 'OutletVisits'] })

  const outcome = hasSold && wroteConsumption
    ? { message: 'Consumption recorded.', resource: CONSUMPTIONS, slug: '' }
    : wroteRestock
      ? {
          message: hasReturns ? 'Returns and restock request recorded.' : 'Restock request created.',
          resource: RESTOCKS,
          slug: 'outlet-restocks'
        }
      : { message: 'Returns recorded.', resource: wroteReturns ? RETURNS : '', slug: 'outlet-returns' }

  return [
    {
      ...nodes[0],
      outcome,
      successMsg: outcome.message,
      ...(draft ? { chainBlock: blocks[0] || '' } : {})
    },
    ...nodes.slice(1)
  ]
}

function returnDeductionOf (returnRows = [], codes = []) {
  if (!codes?.length) return 0
  return asList(returnRows)
    .map(asRow)
    .filter((row) => codes.includes(text(row.Code)))
    .reduce((sum, row) => sum + toNumber(row.Qty) * toNumber(row.Price), 0)
}

export function useConsumptionWorkflow () {
  return { buildConsumptionWorkflowChainNodes }
}
