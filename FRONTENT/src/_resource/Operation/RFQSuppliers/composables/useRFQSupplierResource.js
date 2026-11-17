import { differenceInCalendarDays } from 'date-fns'
import { parseAnyDate } from 'src/utils/dateHelpers'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRFQResource } from 'src/_resource/Operation/RFQs/composables/useRFQResource'
import { useSupplierResource } from 'src/_resource/Master/Suppliers/composables/useSupplierResource'

const text = (value) => String(value ?? '').trim()

export function rfqSupplierTimeline (row = {}, quotation = null) {
  const assigned = parseAnyDate(row.CreatedAt)
  const sent = parseAnyDate(row.SentDate)
  const response = parseAnyDate(quotation?.ResponseDate)
  const responseRecordedAt = parseAnyDate(row.ProgressRespondedAt)
  const responseForElapsed = response || responseRecordedAt
  const sendDays = assigned && sent ? differenceInCalendarDays(sent, assigned) : null
  const days = sent && responseForElapsed ? differenceInCalendarDays(responseForElapsed, sent) : null
  return { assigned, sent, response, sendDays: sendDays != null && sendDays >= 0 ? sendDays : null,
    responseRecordedAt, responseRecordedBy: text(row.ProgressRespondedBy), responseComment: text(row.ProgressRespondedComment),
    responseFromRecordedAt: !response && Boolean(responseRecordedAt),
    responseDays: days != null && days >= 0 ? days : null,
    assignedBy: text(row.CreatedBy),
    recordedAt: parseAnyDate(row.ProgressSentAt), recordedBy: text(row.ProgressSentBy),
    inferred: text(row.ProgressSentComment) === 'Send not recorded; inferred from supplier reply',
    cancelled: parseAnyDate(row.ProgressCancelledAt), cancelledBy: text(row.ProgressCancelledBy),
    cancelledComment: text(row.ProgressCancelledComment) }
}

export function useRFQSupplierResource () {
  const { getRFQ } = useRFQResource()
  const { getSupplier } = useSupplierResource()
  const source = useRecord()
  return {
    selectedRows: (rfqCode, supplierCodes) => {
      const selected = new Set(supplierCodes)
      return source.enriched('RFQSuppliers').filter((row) =>
        (!rfqCode || text(row.RFQCode) === rfqCode) && (!selected.size || selected.has(text(row.SupplierCode))))
    },
    rfqOf: (row) => getRFQ(row?.RFQCode),
    supplierOf: (row) => getSupplier(row?.SupplierCode),
    timelineOf: rfqSupplierTimeline
  }
}
