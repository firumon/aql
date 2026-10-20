/**
 * Counts PR work and sourcing queues for the current user.
 * Reads PurchaseRequisitions: Code, Status, Progress, CreatedBy, RequiredDate,
 * CreatedAt, PRDate, and workflow stamp dates. Foreign drafts are left out.
 * counts: visible records grouped by progress.
 * overdue: open records past their required date.
 * approvalAgeing: pending records grouped by the shared age bands.
 * Controls: none. Search and list tabs do not change these counts.
 */
import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useAuth } from 'src/composables/core/useAuth'
import {
  countsForUser, progressOf, isOverdue, settledAt, daysSince, ageBandOf, AGE_BANDS, PENDING_APPROVAL
} from '../composables/usePurchaseRequisitionProgress'

export default function useRequisitionQueueData () {
  const source = useRecord()
  return source.remember('useRequisitionQueueData', () => {
    const { user } = useAuth()
    const summary = computed(() => {
      const counts = {}
      const ages = AGE_BANDS.map(() => 0)
      let overdue = 0
      for (const row of source.enriched('PurchaseRequisitions')) {
        if (!countsForUser(row, user.value?.id)) continue
        const progress = progressOf(row)
        counts[progress] = (counts[progress] || 0) + 1
        if (isOverdue(row)) overdue++
        if (progress !== PENDING_APPROVAL) continue
        const band = AGE_BANDS.indexOf(ageBandOf(daysSince(settledAt(row))))
        if (band >= 0) ages[band]++
      }
      return { counts, overdue, ages }
    })
    return {
      counts: computed(() => summary.value.counts),
      overdue: computed(() => summary.value.overdue),
      approvalAgeing: computed(() => summary.value.ages)
    }
  })
}
