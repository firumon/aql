/**
 * Shared prepared rows for OutletConsumptions with child-line facts and domain facts.
 *
 * Reads:
 *   OutletConsumptions (enriched proxy records), OutletConsumptionItems, OutletConsumptionInvoices, Outlets
 *
 * Exposes:
 *   default function useData() - returns a shared computed ref of prepared consumption rows
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { decorateRow } from 'src/utils/appHelpers'
import { useConsumptionIndex } from '../composables/useConsumptionIndex'
import { progressOf, daysSince, settledAt } from '../composables/useConsumptionProgress'

const text = (value) => (value == null ? '' : String(value).trim())

export default function useData () {
  const recordSource = useRecord()

  return recordSource.remember('OutletConsumptions:useData', () => {
    const consumptionIndex = useConsumptionIndex()

    return computed(() => {
      const records = recordSource.enriched('OutletConsumptions') || []
      const names = consumptionIndex.outletNameByCode.value
      const invoicedCodes = consumptionIndex.invoicedConsumptionCodes.value

      return records.map((row) => {
        const code = text(row?.Code)
        const outletCode = text(row?.OutletCode)
        const lines = consumptionIndex.consumptionLinesOf(code)
        const progress = progressOf(row)
        const settled = settledAt(row)

        return decorateRow(row, {
          code,
          outletCode,
          outletName: names.get(outletCode) || outletCode,
          progress,
          itemsCount: lines ? lines.items : null,
          totalQty: lines ? lines.qty : null,
          lines: lines || null,
          isInvoiced: invoicedCodes.has(code),
          daysSinceSettled: daysSince(settled),
          _raw: row
        })
      })
    })
  })
}
