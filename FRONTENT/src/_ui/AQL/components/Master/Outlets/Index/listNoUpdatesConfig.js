import { operatingRuleDefaults } from 'src/_resource/Master/OutletOperatingRules/composables/useOutletOperatingRulesResource'

export default function () {
  const days = operatingRuleDefaults().visitFrequencyDays
  return { label: days > 0 ? `No Updates for ${days} ${days === 1 ? 'Day' : 'Days'}` : 'No Updates' }
}
