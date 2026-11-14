import { progressMetaOf } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

const HOUR = 3600000
const DAY = 86400000
const text = value => (value == null ? '' : String(value).trim())

function elapsedLabel (value) {
  let at = NaN
  if (value instanceof Date) at = value.getTime()
  else if (typeof value === 'number') at = value
  else {
    const raw = text(value)
    if (raw) at = /^\d+$/.test(raw) ? Number(raw) : new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw).getTime()
  }
  if (Number.isNaN(at)) return ''
  const gap = Math.max(0, Date.now() - at)
  if (gap < HOUR) return 'Just Now'
  if (gap < DAY) return `${Math.floor(gap / HOUR)} hours ago`
  const days = Math.floor(gap / DAY)
  return days <= 99 ? `${days} days ago` : `${Math.floor(days / 30)} months ago`
}

export default function (row) {
  const meta = progressMetaOf(row.invoice)
  return {
    displayRecentProgress: meta.label,
    displayRecentProgressColor: meta.color,
    displayRecentInvoiceAge: elapsedLabel(row.updatedAt)
  }
}
