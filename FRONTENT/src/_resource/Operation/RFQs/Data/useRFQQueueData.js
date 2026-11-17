/**
 * Shows active RFQ work from RFQs.Progress and QuotationSubmissionDeadline.
 * Reads active RFQSuppliers.Progress by RFQCode.
 * metrics: drafts, assigned, sent, supplier rows awaiting dispatch, and late RFQs.
 * response: replied suppliers divided by sent or replied suppliers on live sent RFQs.
 * Controls: none. List filters do not change the queue.
 */
import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useAuth } from 'src/composables/core/useAuth'
import { useRFQResource } from '../composables/useRFQResource'
import { countsForUser, isActiveRow, isDeadlinePassed, progressOf, progressColor } from '../composables/useRFQProgress'

export default function useRFQQueueData () {
  const source = useRecord()
  const { user } = useAuth()
  return source.remember('useRFQQueueData', () => {
    const reader = useRFQResource()
    const summary = computed(() => {
      const counts = { DRAFT: 0, ASSIGNED: 0, SENT: 0 }
      let dispatch = 0
      let late = 0
      let asked = 0
      let responded = 0
      const me = user.value?.id
      for (const row of source.enriched('RFQs')) {
        const state = progressOf(row)
        if (!isActiveRow(row) || !countsForUser(row, me) || !(state in counts)) continue
        counts[state]++
        if (isDeadlinePassed(row)) late++
        for (const supplier of reader.suppliersOf(row.Code)) {
          if (!isActiveRow(supplier)) continue
          if (supplier.Progress === 'ASSIGNED') dispatch++
          if (state !== 'SENT') continue
          if (['SENT', 'RESPONDED'].includes(supplier.Progress)) asked++
          if (supplier.Progress === 'RESPONDED') responded++
        }
      }
      return { counts, dispatch, late, asked, responded }
    })
    return {
      metrics: computed(() => {
        const { counts, dispatch, late } = summary.value
        if (!Object.values(counts).some(Boolean)) return []
        return [
          ...Object.entries(counts).map(([state, number]) => ({ number, color: progressColor(state),
            label: { DRAFT: 'Drafts', ASSIGNED: 'Assigned', SENT: 'Out for Quoting' }[state] })),
          { label: 'Awaiting Dispatch', number: dispatch, color: 'warning' },
          { label: 'Deadline Passed', number: late, color: 'negative' }
        ]
      }),
      response: computed(() => summary.value.asked ? [{ label: 'Supplier Response Rate',
        value: summary.value.responded, max: summary.value.asked, color: 'positive', unit: 'suppliers' }] : [])
    }
  })
}
