/**
 * Live invoice records with the existing useInvoiceIndex facts.
 * Reads invoice Code/Date/DueDate/Status and existing payment/balance projections.
 * All source sheet headers and live relation getters stay on each record.
 * invoice: the existing domain source invoice.
 * code: the normalized invoice key.
 * outletCode: the existing outlet key.
 * outletName: the existing outlet display name.
 * date: the existing invoice date.
 * dueDate: the existing due date.
 * updatedAt: the existing recency value.
 * progress: the existing invoice progress.
 * username: the existing invoice user.
 * total: the existing invoice total.
 * collected: the existing collected amount.
 * balance: the existing balance.
 * payments: the existing payment rows.
 * ageDays: the existing invoice age.
 * dueInDays: the existing due-date age, or null when unknown.
 * isOverdue: the existing overdue flag.
 * isOpen: membership in the existing open invoice set.
 * search: the existing domain search text.
 * _raw: the live source record.
 * default useData(): one shared computed domain row array. No local controls.
 */
import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { decorateRow } from 'src/utils/appHelpers'
import { useInvoiceIndex } from '../composables/useInvoiceIndex'

export default function useData () {
  const recordSource = useRecord()
  return recordSource.remember('OutletConsumptionInvoices:useData', () => {
    const index = useInvoiceIndex()
    return computed(() => {
      const open = new Set(index.openInvoices.value.map(row => row.code))
      return index.invoiceRows.value.map(fact => {
        const row = recordSource.enrich('OutletConsumptionInvoices', fact.code) || fact.invoice
        return decorateRow(row, { ...fact, isOpen: open.has(fact.code), _raw: row })
      })
    })
  })
}
