import { daysFromToday } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'

export { sortByDate }

export const DRAFT = 'DRAFT'
export const ASSIGNED = 'ASSIGNED'
export const SENT = 'SENT'
export const CLOSED = 'CLOSED'
export const CANCELLED = 'CANCELLED'

export const SUPPLIER_ASSIGNED = 'ASSIGNED'
export const SUPPLIER_SENT = 'SENT'
export const SUPPLIER_RESPONDED = 'RESPONDED'
export const SUPPLIER_CANCELLED = 'CANCELLED'

export const WORKFLOW_STATES = [DRAFT, ASSIGNED, SENT, CLOSED, CANCELLED]
export const EDITABLE_STATES = [DRAFT, ASSIGNED]
export const TERMINAL_STATES = [CLOSED, CANCELLED]
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))
export const SUPPLIER_STATES = [SUPPLIER_ASSIGNED, SUPPLIER_SENT, SUPPLIER_RESPONDED, SUPPLIER_CANCELLED]

export const PROGRESS_META = {
  [DRAFT]: { label: 'Draft', color: 'grey-7', icon: 'edit_note' },
  [ASSIGNED]: { label: 'Assigned', color: 'warning', icon: 'group_add' },
  [SENT]: { label: 'Sent', color: 'primary', icon: 'send' },
  [CLOSED]: { label: 'Closed', color: 'positive', icon: 'lock' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'cancel' }
}

export const SUPPLIER_ROW_META = {
  ...PROGRESS_META,
  [SUPPLIER_ASSIGNED]: { label: 'Assigned', color: 'warning', icon: 'group_add' },
  [SUPPLIER_RESPONDED]: { label: 'Responded', color: 'positive', icon: 'mark_email_read' }
}

export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

export const PROGRESS_COLORS = Object.fromEntries(Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.color]))
export const PROGRESS_ICONS = Object.fromEntries(Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.icon]))
export const PROGRESS_LABELS = Object.fromEntries(Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.label]))

export const PROGRESS_STAMP_PREFIX = {
  [CLOSED]: 'ProgressClosed',
  [CANCELLED]: 'ProgressCancelled'
}

export const WORKFLOW_STAMPS = [
  { state: CLOSED, prefix: 'ProgressClosed', title: 'RFQ Closed' },
  { state: CANCELLED, prefix: 'ProgressCancelled', title: 'RFQ Cancelled' }
]

export const TERM_OPTIONS = {
  leadTimeTypes: ['FLEXIBLE', 'STRICT', 'RANGE_10', 'RANGE_25'],
  shippingTermModes: ['ANY', 'FIXED'],
  shippingTerms: ['EXW', 'FOB', 'CIF', 'DDP'],
  paymentTermModes: ['ANY', 'FIXED'],
  paymentTerms: ['ADVANCE', 'PARTIAL', 'CAD', 'LC', 'CREDIT'],
  quotationValidityModes: ['MIN_REQUIRED', 'MAX_ALLOWED', 'FLEXIBLE'],
  deliveryModes: ['ANY', 'FIXED']
}

export const TERM_LABELS = {
  FLEXIBLE: 'Flexible',
  STRICT: 'Strict',
  RANGE_10: 'Range 10%',
  RANGE_25: 'Range 25%',
  ANY: 'Any',
  FIXED: 'Fixed',
  EXW: 'EXW',
  FOB: 'FOB',
  CIF: 'CIF',
  DDP: 'DDP',
  ADVANCE: 'Advance',
  PARTIAL: 'Partial Advance',
  CAD: 'Against Documents',
  LC: 'Letter of Credit',
  CREDIT: 'Credit Terms',
  MIN_REQUIRED: 'Minimum Required',
  MAX_ALLOWED: 'Maximum Allowed'
}

export const TERM_DESCRIPTIONS = {
  leadTimeTypes: {
    FLEXIBLE: 'Supplier can propose a practical delivery lead time.',
    STRICT: 'Supplier must match the requested lead time.',
    RANGE_10: 'Supplier may vary within about 10 percent.',
    RANGE_25: 'Supplier may vary within about 25 percent.'
  },
  shippingTerms: {
    EXW: 'Ex Works: buyer handles pickup, shipping, customs and delivery.',
    FOB: 'Free On Board: supplier clears goods to origin port; buyer handles freight and import.',
    CIF: 'Cost, Insurance, Freight: supplier covers freight and insurance to destination port.',
    DDP: 'Delivered Duty Paid: supplier delivers cleared goods to the buyer destination.'
  },
  paymentTerms: {
    ADVANCE: 'Prepaid before production or shipment.',
    PARTIAL: 'Split payment, commonly advance plus balance before shipment.',
    CAD: 'Cash against documents: pay after receiving a shipping document copy.',
    LC: 'Letter of credit: bank-backed supplier payment.',
    CREDIT: 'Postpaid supplier credit such as 30, 60 or 90 days.'
  },
  quotationValidityModes: {
    MIN_REQUIRED: 'Quotation must stay valid for at least the entered days.',
    MAX_ALLOWED: 'Quotation validity should not exceed the entered days.',
    FLEXIBLE: 'Supplier may propose a validity period.'
  },
  deliveryModes: {
    ANY: 'Supplier may propose suitable delivery handling.',
    FIXED: 'Supplier must follow the requested delivery handling.'
  }
}

export const AGE_BANDS = [
  { label: '0–2 days', caption: 'On track', color: 'positive', max: 2 },
  { label: '3–5 days', caption: 'Watch', color: 'info', max: 5 },
  { label: '6–10 days', caption: 'Chase', color: 'warning', max: 10 },
  { label: '10+ days', caption: 'Overdue', color: 'negative', max: Infinity }
]

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function termLabel (value) {
  return TERM_LABELS[text(value)] || text(value).replace(/_/g, ' ')
}

export function termOptions (group) {
  const values = TERM_OPTIONS[group] || []
  const descriptions = TERM_DESCRIPTIONS[group] || {}
  return values.map((value) => ({ value, label: termLabel(value), description: descriptions[value] || '' }))
}

export function progressOf (row) {
  return text(row?.Progress).toUpperCase()
}

export function progressColor (state) {
  return PROGRESS_META[text(state).toUpperCase()]?.color || FALLBACK_META.color
}

export function progressIcon (state) {
  return PROGRESS_META[text(state).toUpperCase()]?.icon || FALLBACK_META.icon
}

export function progressLabel (state) {
  const raw = text(state).toUpperCase()
  return PROGRESS_META[raw]?.label || raw || FALLBACK_META.label
}

export function supplierProgressColor (state) {
  return SUPPLIER_ROW_META[text(state).toUpperCase()]?.color || FALLBACK_META.color
}

export function supplierProgressIcon (state) {
  return SUPPLIER_ROW_META[text(state).toUpperCase()]?.icon || FALLBACK_META.icon
}

export function supplierProgressLabel (state) {
  const raw = text(state).toUpperCase()
  return SUPPLIER_ROW_META[raw]?.label || raw || FALLBACK_META.label
}

export function isDraft (row) { return progressOf(row) === DRAFT }
export function isAssigned (row) { return progressOf(row) === ASSIGNED }
export function isEditable (row) { return isActiveRow(row) && EDITABLE_STATES.includes(progressOf(row)) }
export function isSent (row) { return progressOf(row) === SENT }
export function isClosed (row) { return progressOf(row) === CLOSED }
export function isCancelled (row) { return progressOf(row) === CANCELLED }
export function isTerminal (row) { return TERMINAL_STATES.includes(progressOf(row)) }

export function isActiveRow (row) {
  return text(asRow(row).Status || 'Active') === 'Active'
}

export function canAssignSuppliers (row) {
  return isActiveRow(row) && !isTerminal(row)
}

export function canMarkSuppliersSent (row) {
  return isActiveRow(row) && (isAssigned(row) || isSent(row))
}

export function canClose (row) {
  return isSent(row)
}

export function parsePrItemCodeCsv (value = '') {
  return text(value).split(',').map((entry) => entry.trim()).filter(Boolean)
}

export function buildPrItemCodeCsv (items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => text(asRow(item).Code))
    .filter(Boolean)
    .join(',')
}

export function supplierRowsOf (rfq, supplierRows = []) {
  const code = text(asRow(rfq).Code)
  if (!code) return []
  return (Array.isArray(supplierRows) ? supplierRows : [])
    .map(asRow)
    .filter((row) => text(row.RFQCode) === code && isActiveRow(row))
}

export function activeSupplierRowsOf (rfq, supplierRows = []) {
  return supplierRowsOf(rfq, supplierRows).filter((row) => progressOf(row) !== SUPPLIER_CANCELLED)
}

export function assignedSupplierCount (rfq, supplierRows = []) {
  return activeSupplierRowsOf(rfq, supplierRows).length
}

export function respondedSupplierCount (rfq, supplierRows = []) {
  return activeSupplierRowsOf(rfq, supplierRows)
    .filter((row) => progressOf(row) === SUPPLIER_RESPONDED).length
}

export function allSuppliersDispatched (rfq, supplierRows = []) {
  const rows = activeSupplierRowsOf(rfq, supplierRows)
  if (!rows.length) return false
  return !rows.some((row) => progressOf(row) === SUPPLIER_ASSIGNED)
}

export function rfqCancelBlocker (row, { quotations = [], purchaseOrders = [] } = {}) {
  if (!text(row?.Code) || !isActiveRow(row) || isTerminal(row)) return 'Only an active open RFQ can be cancelled.'
  if (quotations.some((q) => isActiveRow(q) && text(q.RFQCode) === text(row.Code))) {
    return 'Cannot cancel this RFQ because supplier quotations have already been recorded.'
  }
  if (purchaseOrders.some((po) => isActiveRow(po) && progressOf(po) !== CANCELLED &&
    (text(po.RFQCode) === text(row.Code) ||
      (text(row.ProcurementCode) && text(po.ProcurementCode) === text(row.ProcurementCode))))) {
    return 'Cannot cancel this RFQ because a purchase order already exists.'
  }
  return ''
}

export function canCancelRfq (row, context = {}) {
  return !rfqCancelBlocker(row, context)
}

export function isOwnedBy (row, userId) {
  const me = text(userId)
  if (!me) return false
  return text(row?.CreatedBy) === me
}

export function countsForUser (row, userId) {
  return !!row && isActiveRow(row) && !(isDraft(row) && !isOwnedBy(row, userId))
}

export function stampOf (row, prefix) {
  const key = text(prefix)
  if (!key) return { at: '', by: '', comment: '' }
  return {
    at: text(row?.[`${key}At`]),
    by: text(row?.[`${key}By`]),
    comment: text(row?.[`${key}Comment`])
  }
}

export function settledAt (row) {
  const stamp = stampOf(row, PROGRESS_STAMP_PREFIX[progressOf(row)])
  return stamp.at || text(row?.RFQDate) || row?.CreatedAt || ''
}

export function daysSince (stampValue) {
  return -daysFromToday(stampValue)
}

export function daysToDeadline (row) {
  return daysFromToday(text(row?.QuotationSubmissionDeadline ?? row?.SubmissionDeadline))
}

export function isDeadlinePassed (row) {
  const days = daysToDeadline(row)
  return Number.isFinite(days) && days < 0 && !isTerminal(row)
}

export function workflowStamps (record) {
  const row = asRow(record)
  return WORKFLOW_STAMPS
    .map((stamp) => {
      const at = text(row[`${stamp.prefix}At`])
      const parsed = at ? new Date(at) : null
      return {
        state: stamp.state,
        title: stamp.title,
        by: text(row[`${stamp.prefix}By`]),
        at,
        comment: text(row[`${stamp.prefix}Comment`]),
        icon: progressIcon(stamp.state),
        color: progressColor(stamp.state),
        label: progressLabel(stamp.state),
        timestamp: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
      }
    })
    .filter((event) => event.by || event.at)
    .sort((a, b) => (a.timestamp?.getTime() ?? Infinity) - (b.timestamp?.getTime() ?? Infinity))
}

export function ageBandOf (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return null
  return AGE_BANDS.find((band) => days <= band.max) || null
}

export function ageColor (days) {
  return ageBandOf(days)?.color || FALLBACK_META.color
}

export function useRFQProgress () {
  return {
    DRAFT,
    ASSIGNED,
    EDITABLE_STATES,
    SENT,
    CLOSED,
    CANCELLED,
    SUPPLIER_ASSIGNED,
    SUPPLIER_SENT,
    SUPPLIER_RESPONDED,
    SUPPLIER_CANCELLED,
    WORKFLOW_STATES,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    SUPPLIER_STATES,
    WORKFLOW_STAMPS,
    PROGRESS_META,
    SUPPLIER_ROW_META,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_LABELS,
    PROGRESS_STAMP_PREFIX,
    TERM_OPTIONS,
    TERM_LABELS,
    TERM_DESCRIPTIONS,
    AGE_BANDS,
    termLabel,
    termOptions,
    progressOf,
    progressColor,
    progressIcon,
    progressLabel,
    supplierProgressColor,
    supplierProgressIcon,
    supplierProgressLabel,
    isDraft,
    isAssigned,
    isEditable,
    isSent,
    isClosed,
    isCancelled,
    isTerminal,
    isActiveRow,
    canAssignSuppliers,
    canMarkSuppliersSent,
    canClose,
    parsePrItemCodeCsv,
    buildPrItemCodeCsv,
    supplierRowsOf,
    activeSupplierRowsOf,
    rfqCancelBlocker,
    canCancelRfq,
    assignedSupplierCount,
    respondedSupplierCount,
    allSuppliersDispatched,
    isOwnedBy,
    countsForUser,
    stampOf,
    settledAt,
    daysSince,
    daysToDeadline,
    isDeadlinePassed,
    workflowStamps,
    ageBandOf,
    ageColor,
    sortByDate
  }
}
