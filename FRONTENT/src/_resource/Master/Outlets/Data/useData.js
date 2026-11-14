/**
 * Live outlet records with facts from useOutletResource and useOutletIndex.
 * Reads Outlets Code/Name/Status, operating rules, price lists, and activity streams.
 * All source sheet headers and live relation getters stay on each record.
 * code: the outlet key.
 * outletCode: the same outlet key for shared presets.
 * name: the outlet name.
 * outlet: the existing domain outlet object from the activity summary.
 * province: the existing summary province.
 * city: the existing summary city.
 * area: the existing summary area.
 * status: the existing summary status.
 * search: the existing summary search text.
 * streams: the existing per-stream activity facts.
 * lastActivityAt: the last activity date.
 * lastActivityDays: the existing age, or null when unknown.
 * lastActivityStream: the last active stream key.
 * lastActivityStreamLabel: the existing stream label.
 * isActive: the existing activity-window flag.
 * restockAt: the existing restock stream date.
 * consumptionAt: the existing consumption stream date.
 * paymentAt: the existing payment stream date.
 * visitAt: the existing visit stream date.
 * ruleCode: the operating rule key.
 * maxStockValueLimit: the existing operating rule value.
 * visitFrequencyDays: the existing visit rule value.
 * invoiceDueDays: the existing invoice rule value.
 * creditLimit: the existing credit rule value.
 * priceListCode: the existing price list key.
 * ruleStatus: the existing operating rule status.
 * hasRules: the existing operating rule flag.
 * operatingRule: the whole operating rule.
 * priceList: the whole price list.
 * _raw: the live source record.
 * default useData(): one shared computed row array. No local controls.
 */
import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { decorateRow } from 'src/utils/appHelpers'
import { useOutletResource } from '../composables/useOutletResource'
import { useOutletIndex } from '../composables/useOutletIndex'

export default function useData () {
  const recordSource = useRecord()

  return recordSource.remember('Master/Outlets:useData', () => {
    const { getOutlet } = useOutletResource()
    const { summaryFor } = useOutletIndex()

    return computed(() => {
      const records = recordSource.enriched('Outlets') || []

      return records.map((row) => {
        const code = row?.Code || ''
        const outletEnriched = getOutlet(code)
        const summary = summaryFor(code)

        return decorateRow(row, {
          ...summary,
          code,
          outletCode: code,
          name: row?.Name || '',

          ruleCode: outletEnriched?.ruleCode || '',
          maxStockValueLimit: outletEnriched?.maxStockValueLimit || 0,
          visitFrequencyDays: outletEnriched?.visitFrequencyDays || 0,
          invoiceDueDays: outletEnriched?.invoiceDueDays || 0,
          creditLimit: outletEnriched?.creditLimit || 0,
          priceListCode: outletEnriched?.priceListCode || '',
          ruleStatus: outletEnriched?.ruleStatus || '',
          hasRules: outletEnriched?.hasRules || false,
          operatingRule: outletEnriched?.operatingRule || null,
          priceList: outletEnriched?.priceList || null,

          streams: summary?.streams || null,
          lastActivityAt: summary?.lastActivityAt || '',
          lastActivityDays: summary?.lastActivityDays ?? null,
          lastActivityStream: summary?.lastActivityStream || '',
          lastActivityStreamLabel: summary?.lastActivityStreamLabel || '',
          isActive: summary?.isActive ?? false,
          restockAt: summary?.streams?.restock?.lastAt || '',
          consumptionAt: summary?.streams?.consumption?.lastAt || '',
          paymentAt: summary?.streams?.payment?.lastAt || '',
          visitAt: summary?.streams?.visit?.lastAt || '',

          _raw: row
        })
      })
    })
  })
}
