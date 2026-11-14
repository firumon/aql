/**
 * Shared prepared rows for OutletVisits with visit countdown and response delay domain facts.
 *
 * Reads:
 *   OutletVisits enriched rows via useRecord().enriched('OutletVisits')
 *
 * Exposes:
 *   default function useData() - returns a shared computed ref of prepared visit rows
 *   - daysUntilVisit: Whole days from today until visit date (positive = future, 0 = today, negative = overdue, null = blank/invalid)
 *   - respondDelayDays: Whole-day delay between planned visit date and response date (positive = late, 0 = same day, negative = early, null = blank/invalid)
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { decorateRow } from 'src/utils/appHelpers'
import { daysUntilVisit, respondDelayDays } from '../composables/useVisitProgress'

export default function useData () {
  const recordSource = useRecord()

  return recordSource.remember('Operation/OutletVisits:useData', () => {
    return computed(() => {
      const records = recordSource.enriched('OutletVisits') || []

      return records.map((row) => {
        return decorateRow(row, {
          get daysUntilVisit () {
            return daysUntilVisit(row)
          },
          get respondDelayDays () {
            return respondDelayDays(row)
          }
        })
      })
    })
  })
}
