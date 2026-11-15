/**
 * OutletVisits list rules and response delay labels.
 *
 * Reads:
 *   OutletVisits rows: Date, RespondDate, Progress; prepared respondDelayDays.
 *
 * Exposes:
 *   default - returns all rows.
 *   Today - planned rows through today and visits responded today; sorted by Date descending.
 *   Overdue - planned rows dated before today.
 *   Tomorrow - planned rows dated tomorrow.
 *   Upcomings - planned rows dated after tomorrow.
 *   Completed - completed rows with a response delay label.
 *   Postponed - postponed rows with a response delay label.
 *   Cancelled - cancelled rows with a response delay label.
 *
 * Controls: none.
 */
import {
  isPlanned,
  daysUntilVisit,
  progressOf,
  COMPLETED,
  POSTPONED,
  CANCELLED
} from '../composables/useVisitProgress'
import { decorateRow } from 'src/utils/appHelpers'
import { sortByDate } from 'src/utils/sortHelpers'
import { daysFromToday } from 'src/utils/dateHelpers'

function presentResponse (rows) {
  return rows.map(row => {
    const days = row.respondDelayDays
    let displayRespondDelay = ''
    if (days === 0) displayRespondDelay = 'On time'
    else if (days != null) {
      const count = Math.abs(days)
      displayRespondDelay = `${count} ${count === 1 ? 'day' : 'days'} ${days > 0 ? 'late' : 'early'}`
    }
    return decorateRow(row, { displayRespondDelay })
  })
}

function all (base) {
  return base
}

function today (base) {
  const due = base.filter(row => {
    const visitDays = daysUntilVisit(row)
    return (
      (isPlanned(row) && visitDays !== null && visitDays <= 0) ||
      daysFromToday(row?.RespondDate) === 0
    )
  })
  return sortByDate(due, 'Date', 'desc')
}

function overdue (base) {
  return base.filter((row) => isPlanned(row) && daysUntilVisit(row) < 0)
}

function tomorrow (base) {
  return base.filter((row) => isPlanned(row) && daysUntilVisit(row) === 1)
}

function upcomings (base) {
  return base.filter((row) => isPlanned(row) && daysUntilVisit(row) > 1)
}

function completed (base) {
  return presentResponse(base.filter((row) => progressOf(row) === COMPLETED))
}

function postponed (base) {
  return presentResponse(base.filter((row) => progressOf(row) === POSTPONED))
}

function cancelled (base) {
  return presentResponse(base.filter((row) => progressOf(row) === CANCELLED))
}

export default {
  default: all,
  Today: today,
  Overdue: overdue,
  Tomorrow: tomorrow,
  Upcomings: upcomings,
  Completed: completed,
  Postponed: postponed,
  Cancelled: cancelled
}
