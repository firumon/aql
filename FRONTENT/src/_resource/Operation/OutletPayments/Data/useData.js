/**
 * Live payment records with the existing useOutletPaymentIndex facts.
 * Reads OutletPayments Code/Date/UpdatedAt/Status and the existing outlet-name index.
 * All source sheet headers and live relation getters stay on each record.
 * code: the normalized payment key.
 * outletCode: the existing outlet key.
 * outletName: the existing outlet display name.
 * invoiceCode: the existing invoice reference.
 * date: the existing payment date.
 * amount: the existing payment amount.
 * mode: the existing payment mode.
 * reference: the existing payment reference.
 * username: the existing payment user.
 * progress: the existing payment progress.
 * isSubmitted: the existing submission flag.
 * isApproved: the existing approval flag.
 * isCancelled: the existing cancellation flag.
 * ageDays: the existing payment age.
 * search: the existing domain search text.
 * recentAt: the existing recencyOf reader result.
 * _raw: the live source record.
 * default useData(): one shared computed domain row array. No local controls.
 */
import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { decorateRow } from 'src/utils/appHelpers'
import { useOutletPaymentIndex } from '../composables/useOutletPaymentIndex'

export default function useData () {
  const recordSource = useRecord()
  return recordSource.remember('OutletPayments:useData', () => {
    const index = useOutletPaymentIndex()
    return computed(() => index.paymentRows.value.map(fact => {
      const row = recordSource.enrich('OutletPayments', fact.code) || fact
      return decorateRow(row, { ...fact, recentAt: index.recencyOf(fact), _raw: row })
    }))
  })
}
