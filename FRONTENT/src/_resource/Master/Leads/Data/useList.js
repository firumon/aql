/**
 * Selects Leads rows for the pipeline tabs and adds final display values.
 * displayLeadName: Name, then Code.
 * displayLeadPlace: City and Area joined for one caption.
 * displayLeadPhones: non-empty phone numbers joined with a comma.
 * displayLeadContact: the first contact person, then the second.
 * displayLeadAge: created age in days or rounded months after 99 days.
 * displayLeadAgeColor: negative after 99 days, otherwise amber-8.
 * displayLeadResponseAge: time since the last follow-up response.
 * No local controls. Layout, field choices, and styles live in APP.Resources.ListViews.
 * RecentlyFollowedUp also reads the shared latest-response index from LeadFollowUps.
 */
import { useLeadResource } from '../composables/useLeadResource'
import { APPROVED, DRAFT, LATER, PROCESSING, REJECTED, progressOf } from '../composables/useLeadProgress'
import { useFollowUpIndex } from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpIndex'
import { sortByDate } from 'src/utils/sortHelpers'
import { daysFromToday, relativeTimeLabel } from 'src/utils/dateHelpers'
import { decorateRow } from 'src/utils/appHelpers'

const asList = (rows) => (Array.isArray(rows) ? rows : [])

function present (rows) {
  return asList(rows).map(lead => {
    const rawDays = daysFromToday(lead?.CreatedAt)
    const days = rawDays === null || Number.isNaN(rawDays) ? null : Math.max(0, -rawDays)
    const count = days !== null && days > 99 ? Math.round(days / 30) : days
    const unit = days !== null && days > 99 ? 'Month' : 'Day'
    return decorateRow(lead, {
      displayLeadName: lead?.Name || lead?.Code || '',
      displayLeadPlace: [lead?.City, lead?.Area].filter(Boolean).join(' • '),
      displayLeadPhones: [lead?.Phone1, lead?.Phone2].filter(value => String(value ?? '').trim()).join(', '),
      displayLeadContact: lead?.ContactPerson1 || lead?.ContactPerson2 || '',
      displayLeadAge: count === null ? '' : `${count} ${unit}${count === 1 ? '' : 's'}`,
      displayLeadAgeColor: (days ?? 0) > 99 ? 'negative' : 'amber-8',
      displayLeadResponseAge: relativeTimeLabel(lead?.lastRespondAt)
    })
  })
}

function byProgress (rows, progress) {
  return present(asList(rows).filter(row => progressOf(row) === progress))
}

function RecentlyFollowedUp () {
  const { leads } = useLeadResource()
  const { lastRespondAtByLead, sortLeadsByLastResponse } = useFollowUpIndex()

  return present(sortLeadsByLastResponse(leads.value).map(lead => decorateRow(lead, {
    lastRespondAt: lastRespondAtByLead.value.get(lead.code)
  })))
}

function Draft (rows) {
  return byProgress(rows, DRAFT)
}

function Processing (rows) {
  return byProgress(rows, PROCESSING)
}

function OldLeads (rows) {
  return sortByDate(byProgress(rows, PROCESSING), 'CreatedAt', 'asc')
}

function Rejected (rows) {
  return byProgress(rows, REJECTED)
}

function Later (rows) {
  return byProgress(rows, LATER)
}

function Approved (rows) {
  return byProgress(rows, APPROVED)
}

export default {
  RecentlyFollowedUp,
  Draft,
  Processing,
  OldLeads,
  Rejected,
  Later,
  Approved
}
