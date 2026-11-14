import { parseAnyDate } from 'src/utils/dateHelpers'
import {
  consumptionRecentAge,
  consumptionRecentTime,
  isCancelled,
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'

function relativeAgeLabel (value) {
  const parsed = parseAnyDate(value)
  if (!parsed) return ''
  const diffMs = Date.now() - parsed.getTime()
  if (diffMs < 0) return 'Just Now'
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'Just Now'
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days <= 99 ? `${days} days ago` : `${Math.floor(days / 30)} months ago`
}

function recentChipColor (row) {
  if (isCancelled(row)) return 'negative'
  const days = consumptionRecentAge(row)
  if (days == null || days <= 1) return 'positive'
  if (days <= 7) return 'info'
  if (days <= 30) return 'warning'
  return 'grey-7'
}

export default function (row) {
  return {
    displayRecentConsumptionAge: relativeAgeLabel(consumptionRecentTime(row)),
    displayRecentConsumptionChipColor: recentChipColor(row)
  }
}
