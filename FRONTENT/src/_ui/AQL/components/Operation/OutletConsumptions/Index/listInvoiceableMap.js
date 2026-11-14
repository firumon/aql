import { parseAnyDate } from 'src/utils/dateHelpers'

const text = value => (value == null ? '' : String(value).trim())

function relativeAgeLabel (value) {
  const parsed = parseAnyDate(value)
  if (!parsed) return ''
  const diffMs = Date.now() - parsed.getTime()
  if (diffMs < 0) return 'Just Now'
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'Just Now'
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days <= 99 ? `${days} days ago` : `${Math.floor(days / 30)} months ago`
}

export default function (row) {
  const lines = row.lines
  const summary = lines ? `${lines.items} Item${lines.items === 1 ? '' : 's'} X ${lines.qty} Qty` : ''
  return {
    displayInvoiceableDateUser: [row.displayConsumptionDate, text(row.Username)].filter(Boolean).join(' · '),
    displayInvoiceableItems: summary,
    displayInvoiceableAge: relativeAgeLabel(row.ProgressPendingInvoiceGenerationAt || row.Date)
  }
}
