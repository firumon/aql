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
import { isActiveRow } from './_shared'

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
    const days = daysUntilVisit(row)
    return isActiveRow(row) && days !== null && days <= 0
  })
  return sortByDate(due, 'Date')
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
