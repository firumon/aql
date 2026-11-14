import { daysSince, settledAt } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'

function elapsedLabel (row) {
  const days = daysSince(settledAt(row))
  if (!Number.isFinite(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export default function (row) {
  const parts = [row.displayConsumptionDate, elapsedLabel(row)].filter(Boolean)
  return { displayCompletedConsumptionCaption: parts.join(' · ') }
}
