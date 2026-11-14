import {
  progressOf, settledAt, sortByDate
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

function progressRows (rows, progress, direction) {
  return sortByDate(
    (Array.isArray(rows) ? rows : []).filter(row => progressOf(row) === progress),
    settledAt,
    direction
  )
}

export default {
  Drafts: rows => progressRows(rows, 'Draft', 'desc'),
  PendingApproval: rows => progressRows(rows, 'Pending Approval', 'asc'),
  NeedsRevision: rows => progressRows(rows, 'Revision Required', 'asc'),
  Approved: rows => progressRows(rows, 'Approved', 'asc'),
  RfqProcessed: rows => progressRows(rows, 'RFQ Processed', 'desc'),
  Rejected: rows => progressRows(rows, 'Rejected', 'desc')
}
