/**
 * Counts owned active PRs, or all loaded active PRs when RFQs:create is allowed.
 * Groups non-closed work by user; visibility uses the signed-in user and RFQ create rights.
 * Reads PurchaseRequisitions: Status, Progress, RequiredDate, Username, CreatedBy.
 * counts: active PR counts for Open, Partially Quoted, Fully Quoted, and Closed.
 * overdue: active non-closed PRs past their required date.
 * userSummary: active non-closed PR counts by user and quote state, largest total first.
 * Controls: none. Search and list tabs do not change these counts.
 */
import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useAuth } from 'src/composables/core/useAuth'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import {
  OPEN, PARTIALLY_QUOTED, FULLY_QUOTED, CLOSED, countsForUser, progressOf, isOverdue, isTerminal, isOwnedBy
} from '../composables/usePurchaseRequisitionProgress'

export default function useRequisitionQueueData () {
  const source = useRecord()
  const { user } = useAuth()
  const rfqConfig = useResourceConfig('RFQs')
  return source.remember('useRequisitionQueueData', () => {
    const summary = computed(() => {
      const counts = { [OPEN]: 0, [PARTIALLY_QUOTED]: 0, [FULLY_QUOTED]: 0, [CLOSED]: 0 }
      const users = new Map()
      const keys = { [OPEN]: 'open', [PARTIALLY_QUOTED]: 'partiallyQuoted', [FULLY_QUOTED]: 'fullyQuoted' }
      let overdue = 0
      const canCreateRfq = rfqConfig.allowed('create') === true
      for (const row of source.enriched('PurchaseRequisitions')) {
        if (!countsForUser(row) || (!canCreateRfq && !isOwnedBy(row, user.value?.id))) continue
        const progress = progressOf(row)
        counts[progress] = (counts[progress] || 0) + 1
        if (isOverdue(row)) overdue++
        if (isTerminal(row)) continue
        const label = String(row.Username || row.CreatedBy || 'Unknown').trim() || 'Unknown'
        if (!users.has(label)) users.set(label, { label, values: { open: 0, partiallyQuoted: 0, fullyQuoted: 0 }, total: 0 })
        const bucket = users.get(label)
        if (keys[progress]) bucket.values[keys[progress]]++
        bucket.total++
      }
      const userSummary = [...users.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
      return { counts, overdue, userSummary }
    })
    return {
      counts: computed(() => summary.value.counts),
      overdue: computed(() => summary.value.overdue),
      userSummary: computed(() => summary.value.userSummary)
    }
  })
}
