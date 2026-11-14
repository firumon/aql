import { hoursFromNow } from 'src/utils/dateHelpers'

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

function humanizedTimeAgo (row) {
  const hours = Math.max(0, -hoursFromNow(row.ProgressSubmittedAt ?? row.date))
  if (Number.isNaN(hours) || hours < 1) return 'Just now'
  if (hours < 24) return `${plural(hours, 'hour')} ago`
  const days = Math.floor(hours / 24)
  return days <= 99 ? `${plural(days, 'day')} ago` : `${plural(Math.floor(days / 30), 'month')} ago`
}

export default function (row) {
  return {
    displayPendingPaymentCaption: [row.date, row.mode, row.username].filter(Boolean).join(' • '),
    displayPendingPaymentAge: humanizedTimeAgo(row)
  }
}
