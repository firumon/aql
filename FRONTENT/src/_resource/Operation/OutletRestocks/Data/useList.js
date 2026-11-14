import { useAuth } from 'src/composables/core/useAuth'
import { decorateRow } from 'src/utils/appHelpers'
import {
  APPROVED,
  DELIVERED,
  DRAFT,
  PARTIALLY_DELIVERED,
  PENDING_APPROVAL,
  REJECTED,
  REVISION_REQUIRED,
  isDraft,
  isOwnedBy,
  ageColor,
  daysSince,
  progressColor,
  progressLabel,
  progressOf,
  settledAt,
  sortByDate
} from '../composables/useRestockProgress'

const rowsOf = (rows) => Array.isArray(rows) ? rows : []
const text = value => (value == null ? '' : String(value).trim())

function ageLabel (days) {
  if (!Number.isFinite(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days`
}

function present (rows) {
  return rows.map(row => {
    const ageDays = daysSince(settledAt(row))
    const progress = progressOf(row)
    return decorateRow(row, {
      displayRestockOutlet: row?.$outlet?.Name || text(row?.OutletCode) || text(row?.Code),
      displayRestockAge: ageLabel(ageDays),
      displayRestockAgeColor: ageColor(ageDays),
      displayRestockProgress: progressLabel(progress),
      displayRestockProgressColor: progressColor(progress)
    })
  })
}

function progressRows (rows, progress, direction) {
  return present(sortByDate(
    rowsOf(rows).filter((row) => progressOf(row) === progress),
    settledAt,
    direction
  ))
}

function recent (rows) {
  return present(sortByDate(
    rowsOf(rows).filter((row) => !isDraft(row)),
    settledAt,
    'desc'
  ).slice(0, 50))
}

function drafts (rows) {
  const { user } = useAuth()
  const userId = user.value?.id

  return present(sortByDate(
    rowsOf(rows).filter((row) => isDraft(row) && isOwnedBy(row, userId)),
    settledAt,
    'desc'
  ))
}

function pendingCompletion (rows) {
  const pending = rowsOf(rows).filter(row => [APPROVED, PARTIALLY_DELIVERED].includes(progressOf(row)))
  return present(sortByDate(pending, settledAt))
}

export default {
  default: rows => rowsOf(rows),
  Recent: recent,
  Drafts: drafts,
  PendingApproval: rows => progressRows(rows, PENDING_APPROVAL, 'asc'),
  NeedsRevision: rows => progressRows(rows, REVISION_REQUIRED, 'asc'),
  Approved: rows => progressRows(rows, APPROVED, 'asc'),
  PartiallyDelivered: rows => progressRows(rows, PARTIALLY_DELIVERED, 'asc'),
  PendingCompletion: pendingCompletion,
  Delivered: rows => progressRows(rows, DELIVERED, 'desc'),
  Rejected: rows => progressRows(rows, REJECTED, 'desc')
}
