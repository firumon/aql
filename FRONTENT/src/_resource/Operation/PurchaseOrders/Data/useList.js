import {
  CREATED, SENT, ACKNOWLEDGED, ACCEPTED, GOODS_RECEIVING, GRN_GENERATED, COMPLETED, CLOSED, CANCELLED, progressOf
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'

function progressRows (rows, progresses) {
  return (Array.isArray(rows) ? rows : []).filter(row => progresses.includes(progressOf(row)))
}

export default {
  Open: rows => progressRows(rows, [CREATED, SENT, ACKNOWLEDGED]),
  Receiving: rows => progressRows(rows, [ACCEPTED, GOODS_RECEIVING]),
  Completed: rows => progressRows(rows, [GRN_GENERATED, COMPLETED, CLOSED]),
  Cancelled: rows => progressRows(rows, [CANCELLED])
}
