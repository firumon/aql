import { batchRefList, isBatchRef, textOrRef } from 'src/utils/appHelpers'
import { addDays, toDateOnly } from 'src/utils/dateHelpers'
import { resourceRow } from 'src/composables/resources/useResourceConfig'
import {
  OPEN, PARTIALLY_QUOTED, FULLY_QUOTED, progressOf, isEditable, isActiveRow, isTerminal, isOwnedBy, rfqCodesOf
} from './usePurchaseRequisitionProgress'

const RESOURCE_NAME = 'PurchaseRequisitions'
const ITEMS_RESOURCE = 'PurchaseRequisitionItems'

export { RESOURCE_NAME, ITEMS_RESOURCE }

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function todayDashed () {
  return toDateOnly(new Date())
}

export function defaultRequiredDate () {
  return toDateOnly(addDays(new Date(), 7))
}

export function requisitionItemRow (child = {}, extra = {}) {
  return resourceRow(ITEMS_RESOURCE, {
    Quantity: 1, QuotedQuantity: 0, RFQCodes: '', Progress: OPEN, Status: 'Active'
  }, child, extra)
}

export function syncRequisitionItems (pageState, selectedSkus = [], selectedCodes) {
  if (!pageState) return
  const selected = new Set((Array.isArray(selectedCodes) ? selectedCodes : selectedSkus.map((row) => row.Code)).map(text))
  const rows = pageState.getChildRows(ITEMS_RESOURCE, RESOURCE_NAME)
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index]
    if (row._action === 'deactivate' || selected.has(text(row.SKU))) continue
    if (row.Code) pageState.setChildAction(ITEMS_RESOURCE, index, 'deactivate', RESOURCE_NAME)
    else pageState.removeChild(ITEMS_RESOURCE, index, RESOURCE_NAME)
  }
  const bySku = new Map()
  pageState.getChildRows(ITEMS_RESOURCE, RESOURCE_NAME).forEach((row, index) => {
    const key = text(row.SKU)
    if (!bySku.has(key) || (isActiveRow(row) && row._action !== 'deactivate')) bySku.set(key, { row, index })
  })
  for (const sku of selectedSkus) {
    const code = text(sku?.Code)
    if (!code || !selected.has(code)) continue
    const existing = bySku.get(code)
    if (existing) {
      if (existing.row._action === 'deactivate' || !isActiveRow(existing.row)) {
        pageState.setChildAction(ITEMS_RESOURCE, existing.index, existing.row.Code ? 'update' : 'create', RESOURCE_NAME)
        pageState.updateChild(ITEMS_RESOURCE, existing.index, { Status: 'Active' }, RESOURCE_NAME)
      }
      continue
    }
    const index = pageState.addChild(ITEMS_RESOURCE, requisitionItemRow({ SKU: code }), RESOURCE_NAME)
    bySku.set(code, { row: pageState.getChildRows(ITEMS_RESOURCE, RESOURCE_NAME)[index], index })
  }
}

export function validateRequisitionDraft ({ form = {}, items = [], source = null, userId = '', headerOnly = false } = {}) {
  const record = asRow(form)
  if (source?.Code && !isEditable(source)) return 'This requisition cannot be edited.'
  if (source?.Code && !isOwnedBy(source, userId) && !text(record.Remarks)) return 'Please add remarks for this edit.'
  if (!text(record.RequiredDate)) return 'Please select a required date.'
  if (headerOnly) return null
  const lines = items.filter((entry) => entry && entry._action !== 'deactivate' && isActiveRow(entry))
  if (!lines.length) return 'Please add at least one product.'
  if (lines.some((entry) => typeof entry.SKU !== 'string' || !text(entry.SKU))) return 'Every product must have a valid SKU.'
  if (lines.some((entry) => !['number', 'string'].includes(typeof entry.Quantity) ||
    !Number.isFinite(Number(entry.Quantity)) || Number(entry.Quantity) < 1)) {
    return 'Every product must have a quantity of at least 1.'
  }
  if (new Set(lines.map((entry) => text(entry.SKU))).size !== lines.length) return 'Each product may appear only once.'
  return null
}

export function buildRequisitionInitNodes (options = {}) {
  const { form = null, items = [], mode = 'add', actorName = '', overrides = {} } = options
  const code = text(form?.Code)
  if (mode === 'descriptions') {
    const records = items.filter((row) => text(row?.Code) && text(row?.PurchaseRequisitionCode) === code && isActiveRow(row))
      .map((row) => requisitionItemRow(row, { _action: 'update' }))
    return records.length ? [{
      resource: ITEMS_RESOURCE, many: true, merge: true, records,
      permissions: { update: 'You are not allowed to update purchase requisition items.' }
    }] : []
  }
  if (mode === 'items') {
    const current = options.currentItems || []
    const bySku = new Map(current.map((row) => [row.SKU, row]))
    const incoming = dedupeItemLines(items).filter(isActiveRow)
    const sourceSkus = new Set(incoming.map((row) => row.SKU))
    const rows = incoming.map((row) => requisitionItemRow(row, {
      ...bySku.get(row.SKU), Code: row.Code,
      _action: bySku.get(row.SKU)?._action === 'deactivate' ? 'deactivate' : 'update'
    })).concat(current.filter((row) => !sourceSkus.has(row.SKU)))
    return [{ resource: RESOURCE_NAME, code, merge: true, children: [{ resource: ITEMS_RESOURCE, records: rows }] }]
  }
  const record = code ? form : {
    PRDate: todayDashed(), RequiredDate: defaultRequiredDate(), ...overrides,
    Username: actorName, Progress: OPEN, Status: 'Active'
  }
  return buildRequisitionCompositeNode({ code, form: record, items })
}

export function buildRequisitionFormData (form = {}, { targetProgress = '', extraFields = {} } = {}) {
  const record = { ...asRow(form), ...extraFields }
  return resourceRow(RESOURCE_NAME, record, {
    PRDate: text(record.PRDate) || todayDashed(),
    RequiredDate: text(record.RequiredDate),
    Progress: text(targetProgress) || progressOf(record) || OPEN,
    Status: text(record.Status) || 'Active'
  })
}

export function dedupeItemLines (items = []) {
  const bySku = new Map()
  for (const entry of (Array.isArray(items) ? items : []).map(asRow)) {
    const key = text(entry.SKU)
    if (!key) continue
    const existing = bySku.get(key)
    if (!existing || ((!isActiveRow(existing) || existing._action === 'deactivate') &&
      isActiveRow(entry) && entry._action !== 'deactivate')) bySku.set(key, entry)
  }
  return Array.from(bySku.values())
}

export function buildRequisitionItemRecords (items = [], deactivatedCodes = []) {
  const source = Array.isArray(items) ? items : []
  const lines = source.filter((entry) => entry && entry._action !== 'deactivate' && isActiveRow(entry))
    .map((entry) => requisitionItemRow(entry, {
      _action: text(entry.Code) ? 'update' : 'create',
      SKU: text(entry.SKU), Quantity: num(entry.Quantity)
    }))
  const removals = [...new Set([
    ...deactivatedCodes,
    ...source.filter((entry) => entry?._action === 'deactivate').map((entry) => entry.Code)
  ].map(text).filter(Boolean))].map((code) => ({ _action: 'deactivate', Code: code, Status: 'Inactive' }))
  return [...lines, ...removals]
}

export function buildRequisitionCompositeNode ({
  code = '', form = {}, targetProgress = '', extraFields = {}, items = [], deactivatedCodes = []
} = {}) {
  const key = textOrRef(code)
  return {
    resource: RESOURCE_NAME,
    ...(key ? { code: key } : {}),
    record: buildRequisitionFormData(form, { targetProgress, extraFields }),
    children: [{ resource: ITEMS_RESOURCE, records: buildRequisitionItemRecords(items, deactivatedCodes) }],
    permissions: { [key ? 'update' : 'create']: 'You are not allowed to save this requisition.' },
    successMsg: 'Requisition saved.'
  }
}

export function buildRequisitionRfqAllocationNodes ({ allocations = [], ...options } = {}) {
  if (!Array.isArray(allocations)) return [{ valid: false, message: 'Quote allocations must be a list.' }]
  return buildRequisitionRfqQuoteEditNodes({
    ...options, allocations: allocations.map((entry) => ({ ...entry, previousQuantity: 0 }))
  })
}

export function buildRequisitionRfqQuoteEditNodes ({ rfqCode, requisitions, items, allocations = [] } = {}) {
  if (!Array.isArray(requisitions) || !Array.isArray(items) || !Array.isArray(allocations)) {
    return [{ valid: false, message: 'Pass the parent requisitions, all sibling items, and quote allocations.' }]
  }
  if (!allocations.length) return []
  const key = textOrRef(rfqCode)
  const refPath = isBatchRef(key) ? text(key.$ref) : (key.startsWith('$ref:') ? key.slice(5).trim() : '')
  if ((typeof key === 'string' && key.startsWith('$ref:') && !refPath) ||
    (!refPath && (typeof rfqCode !== 'string' || !key || key.includes(','))) || (isBatchRef(key) && !refPath)) {
    return [{ valid: false, message: 'A valid RFQ code is required.' }]
  }
  const parents = new Map(requisitions.filter(Boolean).map((row) => [text(row.Code), row]))
  const byCode = new Map()
  const byParent = new Map()
  for (const row of items) {
    if (!row || !text(row.Code)) return [{ valid: false, message: 'Every requisition item needs a code.' }]
    const code = text(row.Code)
    if (byCode.has(code)) return [{ valid: false, message: 'Each requisition item must be passed only once.' }]
    byCode.set(code, row)
    if (!isActiveRow(row) || row._action === 'deactivate') continue
    const parentCode = text(row.PurchaseRequisitionCode)
    if (!byParent.has(parentCode)) byParent.set(parentCode, [])
    byParent.get(parentCode).push(row)
  }
  const updates = new Map()
  const affected = new Set()
  for (const entry of allocations) {
    const code = text(entry?.itemCode)
    const row = byCode.get(code)
    if (!row || !isActiveRow(row) || row._action === 'deactivate') {
      return [{ valid: false, message: 'Every selected requisition item must exist and be active.' }]
    }
    if (updates.has(code)) return [{ valid: false, message: 'Each item may have only one quote allocation.' }]
    const parentCode = text(row.PurchaseRequisitionCode)
    const parent = parents.get(parentCode)
    if (!parentCode || !parent || !isActiveRow(parent) || isTerminal(parent)) {
      return [{ valid: false, message: 'Every parent requisition must exist, be active, and not be closed.' }]
    }
    const quantities = [entry.previousQuantity, entry.quantity, row.Quantity, row.QuotedQuantity ?? 0]
    if (quantities.some((value) => !['number', 'string'].includes(typeof value) ||
      text(value) === '' || !Number.isFinite(Number(value)) || Number(value) < 0) || Number(row.Quantity) <= 0) {
      return [{ valid: false, message: 'Quote quantities must be valid numbers. Requested quantity must be above zero.' }]
    }
    const previous = Number(entry.previousQuantity)
    const quantity = Number(entry.quantity)
    if (refPath && previous > 0) return [{ valid: false, message: 'Use a saved RFQ code to edit or reverse a quote.' }]
    const quoted = Math.max(0, Number(row.QuotedQuantity ?? 0) + quantity - previous)
    if (!Number.isFinite(quoted)) return [{ valid: false, message: 'The total quote quantity is too large.' }]
    const codes = rfqCodesOf(row)
    const rfqCodes = quantity > 0
      ? (refPath ? batchRefList(refPath, codes) : [...new Set([...codes, key])].join(','))
      : codes.filter((code) => code !== key).join(',')
    updates.set(code, {
      Code: code, QuotedQuantity: quoted, RFQCodes: rfqCodes,
      Progress: quoted <= 0 ? OPEN : (quoted >= Number(row.Quantity) ? FULLY_QUOTED : PARTIALLY_QUOTED)
    })
    affected.add(parentCode)
  }
  const parentUpdates = []
  for (const code of affected) {
    let allOpen = true
    let allFull = true
    for (const row of byParent.get(code)) {
      const quantity = Number(row.Quantity)
      const quoted = Number(updates.get(text(row.Code))?.QuotedQuantity ?? row.QuotedQuantity ?? 0)
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(quoted) || quoted < 0) {
        return [{ valid: false, message: 'Every active sibling item must have valid quantities.' }]
      }
      allOpen &&= quoted <= 0
      allFull &&= quoted >= quantity
    }
    parentUpdates.push({ Code: code, Progress: allFull ? FULLY_QUOTED : (allOpen ? OPEN : PARTIALLY_QUOTED) })
  }
  return [{
    resource: ITEMS_RESOURCE, role: 'rfqAllocation', many: true, records: [...updates.values()],
    permissions: { update: 'You are not allowed to update purchase requisition items.' }
  }, {
    resource: RESOURCE_NAME, role: 'rfqAllocation', many: true, records: parentUpdates,
    permissions: { update: 'You are not allowed to update purchase requisitions.' }
  }]
}
