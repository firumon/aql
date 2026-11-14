import {
  DRAFT, SENT, CLOSED, CANCELLED, progressOf, settledAt, sortByDate
} from 'src/_resource/Operation/RFQs/composables/useRFQProgress'

function progressRows (rows, progress, direction) {
  return sortByDate(
    (Array.isArray(rows) ? rows : []).filter(row => progressOf(row) === progress),
    settledAt,
    direction
  )
}

export default {
  Drafts: rows => progressRows(rows, DRAFT, 'asc'),
  Sent: rows => progressRows(rows, SENT, 'asc'),
  Closed: rows => progressRows(rows, CLOSED, 'desc'),
  Cancelled: rows => progressRows(rows, CANCELLED, 'desc')
}
