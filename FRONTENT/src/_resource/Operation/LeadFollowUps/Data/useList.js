/**
 * Selects LeadFollowUps rows and prepares their final display values once per data change.
 * Reads the shared follow-up domain rows, lead names, dates, outcomes, and progress stamps.
 * displayFollowUpLead: joined lead name, then LeadCode.
 * displayFollowUpBody: completed Outcome, otherwise the progress stamp comment.
 * displayFollowUpDelay: on time, late, or early response text.
 * displayFollowUpDelayColor: the final response-delay color.
 * displayFollowUpDue: Today, Tomorrow, or days until the planned date.
 * displayFollowUpAge: time since the response.
 * displayFollowUpOverdue: overdue days as text.
 * displayFollowUpOverdueColor: negative from seven overdue days, otherwise warning.
 * displayFollowUpTodayTop: responder name after a response, otherwise Purpose.
 * displayFollowUpTodayBottom: response body after a response, otherwise PurposeDetail.
 * displayFollowUpTodayIcon: progress icon after a response, otherwise blank.
 * displayFollowUpTodayAge: response age after a response, otherwise blank.
 * displayFollowUpColor: final progress color, including its domain fallback.
 * No local controls. Layout, field choices, and styles live in APP.Resources.ListViews.
 */
import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { decorateRow } from 'src/utils/appHelpers'
import { daysFromToday, parseAnyDate, relativeTimeLabel } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'
import { useFollowUpResource } from '../composables/useFollowUpResource'
import {
  CANCELLED,
  COMPLETED,
  isResponded,
  progressColor,
  progressIcon,
  progressComment,
  respondDelayDays,
  POSTPONED,
  daysUntilFollowUp,
  isAwaiting,
  isOverdue,
  progressOf
} from '../composables/useFollowUpProgress'

const WINDOW_MS = 48 * 60 * 60 * 1000

function rows () {
  const recordSource = useRecord()
  return recordSource.remember('LeadFollowUps:listDisplay', () => {
    const { followUps } = useFollowUpResource()
    return computed(() => followUps.value.map(row => {
      const responded = isResponded(row)
      const body = String(row?.Progress ?? '').trim() === COMPLETED ? row?.Outcome || '' : progressComment(row) || ''
      const delay = respondDelayDays(row)
      const count = Math.abs(delay)
      const due = daysFromToday(row?.Date)
      const overdue = Number.isNaN(due) ? 0 : Math.max(0, -due)
      const age = relativeTimeLabel(row?.RespondDate)
      const delayText = delay === null ? '' : delay === 0 ? 'On time' :
        `${count} ${count === 1 ? 'day' : 'days'} ${delay > 0 ? 'late' : 'early'}`
      return decorateRow(row, {
        displayFollowUpLead: row?.leadName || row?.lead?.Name || row?.$lead?.Name || row?.LeadCode || '',
        displayFollowUpBody: body,
        displayFollowUpDelay: delayText,
        displayFollowUpDelayColor: delay === null ? 'grey-6' : delay > 0 ? 'negative' : delay === 0 ? 'positive' : 'primary',
        displayFollowUpDue: Number.isNaN(due) ? '' : due === 0 ? 'Today' : due === 1 ? 'Tomorrow' :
          `in ${due} ${due === 1 ? 'day' : 'days'}`,
        displayFollowUpAge: age,
        displayFollowUpOverdue: `${overdue} ${overdue === 1 ? 'day' : 'days'}`,
        displayFollowUpOverdueColor: overdue >= 7 ? 'negative' : 'warning',
        displayFollowUpTodayTop: responded ? row?.Username || '' : row?.Purpose || '',
        displayFollowUpTodayBottom: responded ? body : row?.PurposeDetail || '',
        displayFollowUpTodayIcon: responded ? progressIcon(row) : '',
        displayFollowUpTodayAge: responded ? age : '',
        displayFollowUpColor: progressColor(row)
      })
    }))
  }).value
}

function Recent () {
  const now = Date.now()
  const since = now - WINDOW_MS
  const recent = rows().filter((row) => {
    const at = parseAnyDate(row.RespondDate)?.getTime()
    return at !== undefined && at !== null && at >= since && at <= now
  })
  return sortByDate(recent, 'RespondDate', 'desc')
}

function Overdue () {
  return sortByDate(rows().filter(isOverdue), 'Date', 'asc')
}

function Today () {
  const today = rows().filter((row) => row.daysUntil === 0 || daysFromToday(row.RespondDate) === 0)
  return sortByDate(today, 'Date', 'asc')
}

function Tomorrow () {
  return rows().filter((row) => isAwaiting(row) && daysUntilFollowUp(row) === 1)
}

function Upcomings () {
  return sortByDate(rows().filter((row) => isAwaiting(row) && daysUntilFollowUp(row) > 1), 'Date', 'asc')
}

function Completed () {
  return sortByDate(rows().filter((row) => progressOf(row) === COMPLETED), 'RespondDate', 'desc')
}

function Postponed () {
  return sortByDate(rows().filter((row) => progressOf(row) === POSTPONED), 'RespondDate', 'desc')
}

function Cancelled () {
  return sortByDate(rows().filter((row) => progressOf(row) === CANCELLED), 'RespondDate', 'desc')
}

export default {
  default: rows,
  Recent,
  Overdue,
  Today,
  Tomorrow,
  Upcomings,
  Completed,
  Postponed,
  Cancelled
}
