import { daysFromToday, parseAnyDate } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'

export { sortByDate }

export const OPEN = 'Open'
export const PARTIALLY_QUOTED = 'Partially Quoted'
export const FULLY_QUOTED = 'Fully Quoted'
export const CLOSED = 'Closed'
export const CANCELLED = 'Cancelled'

export const WORKFLOW_STATES = [OPEN, PARTIALLY_QUOTED, FULLY_QUOTED, CLOSED, CANCELLED]
export const EDITABLE_STATES = [OPEN, PARTIALLY_QUOTED, FULLY_QUOTED]
export const TERMINAL_STATES = [CLOSED, CANCELLED]
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

export const PROGRESS_META = {
  [OPEN]: { label: OPEN, color: 'warning', icon: 'hourglass_top' },
  [PARTIALLY_QUOTED]: { label: PARTIALLY_QUOTED, color: 'orange', icon: 'incomplete_circle' },
  [FULLY_QUOTED]: { label: FULLY_QUOTED, color: 'positive', icon: 'task_alt' },
  [CLOSED]: { label: CLOSED, color: 'grey-7', icon: 'lock' },
  [CANCELLED]: { label: CANCELLED, color: 'negative', icon: 'cancel' }
}

export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

export const PROGRESS_COLORS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.color]))
export const PROGRESS_ICONS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.icon]))
export const PROGRESS_LABELS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.label]))

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function progressOf (row) {
  const raw = text(row?.Progress)
  const match = WORKFLOW_STATES.find((state) => state.toUpperCase() === raw.toUpperCase())
  return match || raw
}

export function progressColor (state) {
  return PROGRESS_META[progressOf({ Progress: state })]?.color || FALLBACK_META.color
}

export function progressIcon (state) {
  return PROGRESS_META[progressOf({ Progress: state })]?.icon || FALLBACK_META.icon
}

export function progressLabel (state) {
  const normalized = progressOf({ Progress: state })
  return PROGRESS_META[normalized]?.label || normalized || FALLBACK_META.label
}

export function isActiveRow (row) {
  return text(asRow(row).Status) === 'Active'
}

export function isTerminal (row) { return TERMINAL_STATES.includes(progressOf(row)) }

export function requisitionEditableProgress (progress) {
  return EDITABLE_STATES.includes(progressOf({ Progress: progress }))
}

export function isEditable (row) {
  return isActiveRow(row) && !isTerminal(row)
}

export function isRfqEligible (row) {
  return isActiveRow(row) && [OPEN, PARTIALLY_QUOTED].includes(progressOf(row))
}

export function isOwnedBy (row, userId) {
  const me = text(userId)
  if (!me) return false
  return text(row?.CreatedBy) === me
}

export function canEditRequisition (row, userId, { updateAllowed = false, rfqCreateAllowed = false } = {}) {
  return isEditable(row) && updateAllowed === true && (isOwnedBy(row, userId) || rfqCreateAllowed === true)
}

export function canCancelRequisition (row, userId, { cancelAllowed = false, rfqCreateAllowed = false } = {}) {
  return isActiveRow(row) && progressOf(row) === OPEN && cancelAllowed === true &&
    (isOwnedBy(row, userId) || rfqCreateAllowed === true)
}

export function countsForUser (row) {
  return !!row && isActiveRow(row)
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
  return row?.CreatedAt || text(row?.PRDate) || text(row?.RequiredDate) || ''
}

export function daysSince (stampValue) {
  return -daysFromToday(stampValue)
}

export function daysToRequired (row) {
  return daysFromToday(text(row?.RequiredDate))
}

export function isOverdue (row) {
  const days = daysToRequired(row)
  return Number.isFinite(days) && days < 0 && !isTerminal(row)
}

export const AGE_BANDS = [
  { label: '0–1 days', caption: 'On track', color: 'positive', max: 1 },
  { label: '2–3 days', caption: 'Watch', color: 'info', max: 3 },
  { label: '4–7 days', caption: 'Chase', color: 'warning', max: 7 },
  { label: '7+ days', caption: 'Overdue', color: 'negative', max: Infinity }
]

export function ageBandOf (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return null
  return AGE_BANDS.find((band) => days <= band.max) || null
}

export function ageColor (days) {
  return ageBandOf(days)?.color || FALLBACK_META.color
}

export function rfqCodesOf (row) {
  return [...new Set(text(row?.RFQCodes).split(',').map(text).filter(Boolean))]
}

export function requisitionWorkflowEvents (requisition, lines = [], rfqMap = new Map()) {
  if (!requisition?.Code) return []
  const state = progressOf(requisition)
  const activeLines = lines.filter(line => isActiveRow(line) && line._action !== 'deactivate')
  const events = [{
    state: OPEN, ...PROGRESS_META[OPEN], title: 'Requisition Created',
    by: text(requisition.Username), at: requisition.CreatedAt || text(requisition.PRDate), comment: text(requisition.Remarks)
  }]
  if ([PARTIALLY_QUOTED, FULLY_QUOTED].includes(state) ||
    activeLines.some(line => (Number(line.QuotedQuantity) || 0) > 0 || rfqCodesOf(line).length > 0)) {
    const fullyQuoted = state === FULLY_QUOTED || (activeLines.length > 0 && activeLines.every(line =>
      Number(line.Quantity) > 0 && Number(line.QuotedQuantity) >= Number(line.Quantity)))
    const quotedState = fullyQuoted ? FULLY_QUOTED : PARTIALLY_QUOTED
    const codes = [...new Set(activeLines.flatMap(rfqCodesOf))]
    const linkedRfqs = codes.map(code => rfqMap.get(code)).filter(Boolean)
    const latest = sortByDate(linkedRfqs, row => row.RFQDate || row.CreatedAt, 'desc')[0]
    const latestAt = latest?.RFQDate || latest?.CreatedAt
    events.push({
      state: quotedState, ...PROGRESS_META[quotedState], title: 'Requisition Quoted',
      by: [...new Set(linkedRfqs.map(row => text(row.User)).filter(Boolean))].join(', '),
      at: parseAnyDate(latestAt) ? latestAt : requisition.UpdatedAt,
      rfqCodes: codes.map(code => {
        const rfq = rfqMap.get(code)
        return { code, date: rfq?.RFQDate || rfq?.CreatedAt || '', progress: text(rfq?.Progress) }
      })
    })
  }
  if (state === CLOSED) events.push({
    state: CLOSED, ...PROGRESS_META[CLOSED], title: 'Requisition Closed',
    by: text(requisition.UpdatedBy), at: requisition.UpdatedAt
  })
  if (state === CANCELLED) events.push({
    state: CANCELLED, ...PROGRESS_META[CANCELLED], title: 'Requisition Cancelled',
    by: text(requisition.ProgressCancelledBy), at: requisition.ProgressCancelledAt || requisition.UpdatedAt,
    comment: text(requisition.ProgressCancelledComment)
  })
  return events
}
