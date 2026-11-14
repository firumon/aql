import {
  RECEIVED, ACCEPTED, REJECTED, progressOf
} from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'

function progressRows (rows, progress) {
  return (Array.isArray(rows) ? rows : []).filter(row => progressOf(row) === progress)
}

export default {
  Received: rows => progressRows(rows, RECEIVED),
  Accepted: rows => progressRows(rows, ACCEPTED),
  Rejected: rows => progressRows(rows, REJECTED)
}
