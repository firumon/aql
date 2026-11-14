import { hoursFromNow } from 'src/utils/dateHelpers'
import { daysSince, settledAt } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

function ageLabel (days) {
  if (!Number.isFinite(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days`
}

function recentAgeLabel (row) {
  const stamp = settledAt(row)
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

export default row => ({
  displayRecentDeliveryAge: recentAgeLabel(row),
  displayRecentDeliveryCaption: [row.Date, `${row.displayDeliveryItemCount} items`].filter(Boolean).join(' • ')
})
