import { computed } from 'vue'
import { findResourceConfig } from 'src/composables/resources/useResourceConfig'
import useRequisitionQueueData from 'src/_resource/Operation/PurchaseRequisitions/Data/useRequisitionQueueData'
import useRFQQueueData from 'src/_resource/Operation/RFQs/Data/useRFQQueueData'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

export function useRFQIndexContext () {
  const data = useRequisitionQueueData()
  const rfqQueue = useRFQQueueData()
  const canRead = computed(() => Boolean(findResourceConfig('PurchaseRequisitions')?.permissions?.canRead))
  const metrics = computed(() => {
    if (!canRead.value) return []
    const open = data.counts.value.Open || 0
    const partial = data.counts.value['Partially Quoted'] || 0
    if (!open && !partial) return []
    return [
      { label: 'Open PRs', number: open, color: 'primary' },
      { label: 'Partially Quoted PRs', number: partial, color: 'warning' },
      { label: 'Pending Items', number: data.pendingItems.value, color: 'info' },
      { label: 'Remaining Quantity', number: data.remainingQuantity.value, color: 'info' }
    ]
  })
  return { ui: useAQLConfig(), metrics, rfqMetrics: rfqQueue.metrics, rfqResponse: rfqQueue.response,
    rows: computed(() => canRead.value ? data.pendingUserSummary.value : []),
    series: [{ key: 'open', label: 'Open', color: 'primary' },
      { key: 'partiallyQuoted', label: 'Partially Quoted', color: 'warning' }]
  }
}
