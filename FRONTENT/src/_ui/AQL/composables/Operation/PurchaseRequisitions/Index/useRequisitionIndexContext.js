import { computed, inject } from 'vue'
import { useProcurementIndexContext } from 'src/_ui/AQL/composables/Operation/useProcurementIndexContext'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import useRequisitionQueueData from 'src/_resource/Operation/PurchaseRequisitions/Data/useRequisitionQueueData'
import {
  PENDING_APPROVAL, REVISION_REQUIRED, APPROVED, RFQ_PROCESSED, AGE_BANDS, progressColor,
  progressOf, isDraft, isOwnedBy
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

export function useRequisitionIndexContext () {
  const resourceConfig = inject('resourceConfig', null)
  const { nav, user } = useProcurementIndexContext()
  const { counts, overdue, approvalAgeing } = useRequisitionQueueData()
  const canReview = computed(() => resourceConfig?.allowed('review', 'PurchaseRequisitions') === true)
  const queueCards = computed(() => {
    const cards = [
      { label: 'Pending Approval', number: counts.value[PENDING_APPROVAL] || 0, color: progressColor(PENDING_APPROVAL) },
      { label: 'Needs Revision', number: counts.value[REVISION_REQUIRED] || 0, color: progressColor(REVISION_REQUIRED) },
      { label: 'Past Required Date', number: overdue.value, color: 'negative' }
    ]
    return cards.some((card) => card.number) ? cards : []
  })
  const sourcingCards = computed(() => {
    const cards = [
      { label: 'Ready for RFQ', number: counts.value[APPROVED] || 0, color: progressColor(APPROVED) },
      { label: 'RFQ Processed', number: counts.value[RFQ_PROCESSED] || 0, color: progressColor(RFQ_PROCESSED) }
    ]
    return cards.some((card) => card.number) ? cards : []
  })
  const buckets = computed(() => !canReview.value || !counts.value[PENDING_APPROVAL] ? [] : AGE_BANDS.map((band, index) => ({
    label: band.label, caption: band.caption, color: band.color, count: approvalAgeing.value[index]
  })))
  return {
    nav, user, resourceConfig, ui: useAQLConfig(), queueCards, sourcingCards, buckets,
    canEdit: (row) => isDraft(row) && isOwnedBy(row, user.value?.id) &&
      resourceConfig?.allowed('update', 'PurchaseRequisitions', row) === true,
    rowActions: (row) => {
      const state = progressOf(row)
      if (state === PENDING_APPROVAL && resourceConfig?.allowed('review', 'PurchaseRequisitions', row)) return ['Review']
      if (state === REVISION_REQUIRED && resourceConfig?.allowed('update', 'PurchaseRequisitions', row)) return ['Revise']
      return []
    }
  }
}
