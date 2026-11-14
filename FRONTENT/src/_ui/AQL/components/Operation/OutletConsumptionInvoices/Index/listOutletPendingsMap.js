import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

const text = value => (value == null ? '' : String(value).trim())
const HOUR = 3600000
const DAY = 86400000

function elapsedLabel (value) {
  const raw = text(value)
  if (!raw) return ''
  const at = /^\d+$/.test(raw) ? Number(raw) : new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw).getTime()
  if (Number.isNaN(at)) return ''
  const gap = Math.max(0, Date.now() - at)
  if (gap < HOUR) return 'Just Now'
  if (gap < DAY) return `${Math.floor(gap / HOUR)} hours ago`
  const days = Math.floor(gap / DAY)
  return days <= 99 ? `${days} days ago` : `${Math.floor(days / 30)} months ago`
}

export default function (row) {
  const { _C } = useCurrencyResource()
  const oldest = row.oldestDate ? `Since: ${row.oldestDate} (${elapsedLabel(row.oldestDate)})` : ''
  return {
    displayPendingOutlet: text(row.outletName) || text(row.outletCode),
    displayPendingSummary: `${row.invoiceCount} Invoice${row.invoiceCount === 1 ? '' : 's'} · ${row.overdueCount} Overdue`,
    displayPendingOldest: oldest,
    displayPendingBalance: _C(row.balance, true)
  }
}
