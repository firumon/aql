import { parseAnyDate } from 'src/utils/dateHelpers'

function plural (count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function relativeAgeLabel (value) {
  const parsed = parseAnyDate(value)
  if (!parsed) return ''
  const diffMs = Date.now() - parsed.getTime()
  if (diffMs < 0) return 'Just Now'
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'Just Now'
  if (hours < 24) return `${plural(hours, 'hour')} ago`
  const days = Math.floor(hours / 24)
  return days <= 99 ? `${plural(days, 'day')} ago` : `${plural(Math.floor(days / 30), 'month')} ago`
}

export default function (row) {
  const count = Number(row.uninvoicedCount) || 0
  const oldest = relativeAgeLabel(row.oldestUninvoicedDate || row.lastAuditDate)
  const newest = relativeAgeLabel(row.newestUninvoicedDate || row.lastAuditDate)
  const firstCaption = count <= 1
    ? (oldest ? `Consumption: ${oldest}` : 'Awaiting invoice')
    : (oldest ? `Oldest Consumption: ${oldest}` : '')
  return {
    displayInvoiceableOutlet: row.outletName || row.outletCode || '',
    displayInvoiceableOutletsFirstCaption: firstCaption,
    displayInvoiceableOutletsSecondCaption: count <= 1 || !newest ? '' : `Newest Consumption: ${newest}`,
    displayInvoiceableOutletsChip: `${count}x Consumption${count === 1 ? '' : 's'}`
  }
}
