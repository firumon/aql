import { computed, inject } from 'vue'
import { useProcurementIndexContext } from 'src/_ui/AQL/composables/Operation/useProcurementIndexContext'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import useRequisitionQueueData from 'src/_resource/Operation/PurchaseRequisitions/Data/useRequisitionQueueData'
import {
  OPEN, PARTIALLY_QUOTED, FULLY_QUOTED, progressColor
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

export function useRequisitionIndexContext () {
  const resourceConfig = inject('resourceConfig', null)
  const { user } = useProcurementIndexContext()
  const { counts, overdue, userSummary } = useRequisitionQueueData()
  const metricCards = computed(() => {
    const cards = [
      { label: 'Open', number: counts.value[OPEN] || 0, color: progressColor(OPEN) },
      { label: 'Partially Quoted', number: counts.value[PARTIALLY_QUOTED] || 0, color: progressColor(PARTIALLY_QUOTED) },
      { label: 'Past Required Date', number: overdue.value || 0, color: 'negative' },
      { label: 'Fully Quoted', number: counts.value[FULLY_QUOTED] || 0, color: progressColor(FULLY_QUOTED) }
    ]
    return cards.some((card) => card.number) ? cards : []
  })
  const userSummarySeries = [
    { key: 'open', label: 'Open', color: progressColor(OPEN) },
    { key: 'partiallyQuoted', label: 'Partially Quoted', color: progressColor(PARTIALLY_QUOTED) },
    { key: 'fullyQuoted', label: 'Fully Quoted', color: progressColor(FULLY_QUOTED) }
  ]
  return {
    user, resourceConfig, ui: useAQLConfig(), metricCards,
    userSummary: computed(() => userSummary.value), userSummarySeries
  }
}
