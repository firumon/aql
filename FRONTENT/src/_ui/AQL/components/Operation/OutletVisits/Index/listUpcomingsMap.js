import { daysUntilVisit } from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'

function countdownLabel (days) {
  if (days === null || days === undefined) return ''
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 0) {
    const overdue = Math.abs(days)
    return `${overdue} ${overdue === 1 ? 'day' : 'days'} overdue`
  }
  return `${days} days`
}

export default function (row) {
  return { displayVisitCountdown: countdownLabel(daysUntilVisit(row)) }
}
