/**
 * Lists active PRs by quote state, using Status, Progress, CreatedBy, PRDate, RequiredDate, CreatedAt, and ProgressCancelledAt.
 * MyOpen shows the user's Open PRs; AllOpen needs RFQs:create and shows all loaded Open PRs.
 * Other states show all loaded PRs for RFQ creators, and owned PRs for other users.
 * Open and quote lists sort oldest first; Closed and Cancelled sort newest first. Controls: none.
 * Cancelled adds displayCancelledDate from ProgressCancelledAt for its date chip.
 */
import { decorateRow } from 'src/utils/appHelpers'
import { parseAnyDate } from 'src/utils/dateHelpers'
import { useAuth } from 'src/composables/core/useAuth'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import {
  OPEN, PARTIALLY_QUOTED, FULLY_QUOTED, CLOSED, CANCELLED, progressOf, settledAt, sortByDate, isActiveRow, isOwnedBy
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

function progressRows (rows, progress, direction, scope = '') {
  const { user } = useAuth()
  const canCreateRfq = useResourceConfig('RFQs').allowed('create') === true
  if (scope === 'all' && !canCreateRfq) return []
  return sortByDate(
    (Array.isArray(rows) ? rows : []).filter(row => isActiveRow(row) && progressOf(row) === progress &&
      ((scope !== 'mine' && canCreateRfq) || isOwnedBy(row, user.value?.id))),
    settledAt,
    direction
  )
}

export const MyOpen = rows => progressRows(rows, OPEN, 'asc', 'mine')
export const AllOpen = rows => progressRows(rows, OPEN, 'asc', 'all')
export const PartiallyQuoted = rows => progressRows(rows, PARTIALLY_QUOTED, 'asc')
export const FullyQuoted = rows => progressRows(rows, FULLY_QUOTED, 'asc')
export const Closed = rows => progressRows(rows, CLOSED, 'desc')

export const Cancelled = rows => sortByDate(
  progressRows(rows, CANCELLED, 'desc'),
  row => row.ProgressCancelledAt || settledAt(row),
  'desc'
).map(row => {
  const cancelledAt = parseAnyDate(row.ProgressCancelledAt)
  return decorateRow(row, {
    displayCancelledDate: cancelledAt
      ? cancelledAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
  })
})

export default { MyOpen, AllOpen, PartiallyQuoted, FullyQuoted, Closed, Cancelled }
