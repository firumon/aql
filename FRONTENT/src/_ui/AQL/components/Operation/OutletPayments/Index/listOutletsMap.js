import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

const text = value => (value == null ? '' : String(value).trim())

export default function (row) {
  const { _C } = useCurrencyResource()
  const count = Number(row.invoiceCount) || 0
  return {
    displayDebtOutlet: text(row.name) || text(row.code),
    displayDebtInvoiceCount: `${count} open invoice${count === 1 ? '' : 's'}`,
    displayDebtTotal: _C(row.totalBalance, true)
  }
}
