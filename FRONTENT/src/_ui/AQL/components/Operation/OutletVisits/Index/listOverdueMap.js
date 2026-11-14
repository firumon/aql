import { daysUntilVisit } from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'

export default function (row) {
  const days = daysUntilVisit(row)
  const overdue = Math.abs(days)
  return { displayOverdueDays: Number.isFinite(days) ? `${overdue} ${overdue === 1 ? 'Day' : 'Days'}` : '' }
}
