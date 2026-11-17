/**
 * Lists active RFQs in Drafts, Assigned, Sent, Closed, and Cancelled.
 * Reads Progress, RFQDate, CreatedAt, close/cancel stamps, and RFQItems quantities.
 * Open queues show item totals and sort oldest first. Closed and Cancelled sort newest first and add stamp dates.
 * Controls: none. useRFQResource owns the item data and totals.
 */
import { decorateRow } from 'src/utils/appHelpers'
import { parseAnyDate } from 'src/utils/dateHelpers'
import { useRFQResource } from '../composables/useRFQResource'
import {
  DRAFT, ASSIGNED, SENT, CLOSED, CANCELLED, progressOf, settledAt, sortByDate, isActiveRow
} from '../composables/useRFQProgress'

function progressRows (rows, progress, direction) {
  const prefix = progress === CLOSED ? 'ProgressClosed' : progress === CANCELLED ? 'ProgressCancelled' : ''
  const sorted = sortByDate((Array.isArray(rows) ? rows : []).filter((row) => isActiveRow(row) && progressOf(row) === progress),
    (row) => row[prefix + 'At'] || settledAt(row), direction)
  const reader = useRFQResource()
  return sorted.map((row) => {
    if (!prefix) {
      const summary = reader.itemSummary(reader.itemsByRfq.value.get(row.Code) || [])
      return decorateRow(row, { displayItemSummary: summary.lines + ' items | ' + summary.quantity + ' units' })
    }
    const date = parseAnyDate(row[prefix + 'At'])
    return decorateRow(row, {
      [progress === CLOSED ? 'displayClosedDate' : 'displayCancelledDate']:
        date ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
    })
  })
}

export const Drafts = rows => progressRows(rows, DRAFT, 'asc')
export const Assigned = rows => progressRows(rows, ASSIGNED, 'asc')
export const Sent = rows => progressRows(rows, SENT, 'asc')
export const Closed = rows => progressRows(rows, CLOSED, 'desc')
export const Cancelled = rows => progressRows(rows, CANCELLED, 'desc')

export default { Drafts, Assigned, Sent, Closed, Cancelled }
