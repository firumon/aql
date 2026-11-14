import { useRecord } from 'src/composables/resources/useRecord'
import { isActiveRow, isCancelled } from './useReturnProgress'

const RESOURCE_NAME = 'OutletReturns'

const text = (value) => String(value ?? '').trim()

export { RESOURCE_NAME }

export function useReturnResource () {
  const record = useRecord()

  const returnsOfInvoice = (invoiceCode, { source = false } = {}) => {
    const key = text(invoiceCode)
    if (!key) return []
    const field = source ? 'SourceInvoiceCode' : 'ConsumptionInvoiceCode'
    const rows = record.recordsBy(RESOURCE_NAME, field, key)
    return source ? rows.filter((row) => isActiveRow(row) && !isCancelled(row)) : rows
  }

  return {
    returnsOfInvoice
  }
}
