import { daysUntilVisit, isPlanned, plannedComment, progressOf } from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'

const join = parts => parts.filter(part => String(part ?? '').trim()).join(' • ')

function visitCaption (row) {
  const next = row.NextDate ? `Next: ${row.NextDate}` : ''
  switch (progressOf(row)) {
    case 'COMPLETED':
      return join([row.ProgressCompletedComment || row.Comment || '', next])
    case 'POSTPONED':
      return join([next, row.ProgressPlannedComment || ''])
    case 'CANCELLED':
      return row.ProgressCancelledComment || row.Comment || ''
    default:
      return plannedComment(row)
  }
}

export default function (row) {
  const days = daysUntilVisit(row)
  const overdue = isPlanned(row) && days !== null && days < 0
  const count = Math.abs(days)
  return {
    displayTodayFirstCaption: overdue ? `${row.Date} • Due by ${count} ${count === 1 ? 'day' : 'days'}` : row.Date,
    displayTodaySecondCaption: visitCaption(row)
  }
}
