/**
 * Counts owned active PRs, or all loaded active PRs when RFQs:create is allowed.
 * Groups non-closed work by user; visibility uses the signed-in user and RFQ create rights.
 * Reads PurchaseRequisitions: Status, Progress, RequiredDate, Username, CreatedBy.
 * counts: active PR counts for Open, Partially Quoted, Fully Quoted, and Closed.
 * overdue: active non-closed PRs past their required date.
 * userSummary: active non-closed PR counts by user and quote state, largest total first.
 * pendingItems: active open item rows in Open and Partially Quoted PRs.
 * remainingQuantity: their positive Quantity minus QuotedQuantity.
 * pendingUserSummary: open and partially quoted counts by user, with pending totals only.
 * pendingRequisitions: active Open and Partially Quoted rows for the RFQ helper.
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
      let pendingItems = 0
      let remainingQuantity = 0
      const pendingCodes = new Set()
      const canCreateRfq = rfqConfig.allowed('create') === true
      for (const row of source.enriched('PurchaseRequisitions')) {
        if (!countsForUser(row) || (!canCreateRfq && !isOwnedBy(row, user.value?.id))) continue
        const progress = progressOf(row)
        if ([OPEN, PARTIALLY_QUOTED].includes(progress)) pendingCodes.add(row.Code)
        counts[progress] = (counts[progress] || 0) + 1
        if (isOverdue(row)) overdue++
        if (isTerminal(row)) continue
        const label = String(row.Username || row.CreatedBy || 'Unknown').trim() || 'Unknown'
        if (!users.has(label)) users.set(label, { label, values: { open: 0, partiallyQuoted: 0, fullyQuoted: 0 }, total: 0 })
        const bucket = users.get(label)
        if (keys[progress]) bucket.values[keys[progress]]++
        bucket.total++
      }
      for (const item of source.enriched('PurchaseRequisitionItems')) {
        if (item.Status !== 'Active' || !pendingCodes.has(item.PurchaseRequisitionCode)) continue
        const remaining = Math.max(0, (Number(item.Quantity) || 0) - (Number(item.QuotedQuantity) || 0))
        if (remaining > 0) { pendingItems++; remainingQuantity += remaining }
      }
      const userSummary = [...users.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
      return { counts, overdue, userSummary, pendingItems, remainingQuantity }
    })
    return {
      pendingRequisitions: computed(() => source.enriched('PurchaseRequisitions')
        .filter(row => countsForUser(row) && (rfqConfig.allowed('create') === true || isOwnedBy(row, user.value?.id)) &&
          [OPEN, PARTIALLY_QUOTED].includes(progressOf(row)))),
      pendingUserSummary: computed(() => summary.value.userSummary
        .filter(row => row.values.open || row.values.partiallyQuoted)
        .map(row => ({ ...row, total: row.values.open + row.values.partiallyQuoted }))),
      pendingItems: computed(() => summary.value.pendingItems),
      remainingQuantity: computed(() => summary.value.remainingQuantity),
      counts: computed(() => summary.value.counts),
      overdue: computed(() => summary.value.overdue),
      userSummary: computed(() => summary.value.userSummary)
    }
  })
}
