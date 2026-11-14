import {
  DRAFT, CONFIRMED, GRN_GENERATED, CANCELLED,
  isActiveRow, progressOf, settledAt, sortByDate
} from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'

function activeRows (rows) {
  return (Array.isArray(rows) ? rows : []).filter(isActiveRow)
}

function progressRows (rows, progress, direction) {
  return sortByDate(
    activeRows(rows).filter(row => progressOf(row) === progress),
    settledAt,
    direction
  )
}

export default {
  default: rows => activeRows(rows),
  Drafts: rows => progressRows(rows, DRAFT, 'desc'),
  Confirmed: rows => progressRows(rows, CONFIRMED, 'asc'),
  GrnGenerated: rows => progressRows(rows, GRN_GENERATED, 'desc'),
  Cancelled: rows => progressRows(rows, CANCELLED, 'desc')
}
