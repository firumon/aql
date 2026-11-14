import { hoursFromNow, toDateOnly } from 'src/utils/dateHelpers'
import { ageColor, daysSince } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

const text = value => (value == null ? '' : String(value).trim())

function ageLabel (days) {
  if (!Number.isFinite(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days`
}

function relativeAgeLabel (stamp) {
  const hours = hoursFromNow(stamp)
  if (!Number.isNaN(hours)) {
    const past = Math.max(0, -hours)
    if (past < 1) return 'just now'
    if (past < 24) return past === 1 ? '1 hour' : `${past} hours`
  }
  const days = daysSince(stamp)
  if (!Number.isFinite(days)) return ''
  if (days > 99) return `${Math.floor(days / 30)} months`
  return ageLabel(days)
}

export default function (row) {
  const count = Number(row.itemCount) || 0
  const countLabel = `${count} item${count === 1 ? '' : 's'}`
  return {
    displayQueueOutlet: text(row.outletName) || text(row.outletCode),
    displayQueueCaption: [toDateOnly(row.oldestAt), countLabel].filter(Boolean).join(' • '),
    displayQueueAge: relativeAgeLabel(row.oldestAt),
    displayQueueAgeColor: ageColor(row.oldestDays)
  }
}
