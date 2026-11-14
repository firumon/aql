import { daysFromToday, hoursFromNow } from 'src/utils/dateHelpers'

const text = value => (value == null ? '' : String(value).trim())

function ageLabel (days) {
  if (!Number.isFinite(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days`
}

function recentAgeLabel (row) {
  const stamp = text(row.UpdatedAt) || text(row.CreatedAt) || text(row.Date)
  const hours = hoursFromNow(stamp)
  if (!Number.isNaN(hours)) {
    const past = Math.max(0, -hours)
    if (past < 1) return 'Just now'
    if (past < 24) return past === 1 ? '1 hour ago' : `${past} hours ago`
  }
  const days = -daysFromToday(stamp)
  if (!Number.isFinite(days)) return ''
  if (days > 99) return `${Math.floor(days / 30)} months`
  return ageLabel(days)
}

export default row => ({ displayRecentReturnAge: recentAgeLabel(row) })
