import { useRecord } from 'src/composables/resources/useRecord'
import { decorateRow } from 'src/utils/appHelpers'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useOutletPaymentIndex } from '../composables/useOutletPaymentIndex'

const newest = (a, b) => (b.date || '').localeCompare(a.date || '')
const text = value => (value == null ? '' : String(value).trim())

function present (rows) {
  const { _C } = useCurrencyResource()
  return rows.map(row => {
    const progress = String(row.progress || row.Progress || '').trim().toUpperCase()
    const color = row.isCancelled || progress === 'CANCELLED' ? 'grey-7' :
      (row.isApproved || progress === 'APPROVED' ? 'positive' : 'warning')
    return decorateRow(row, {
      displayPaymentOutlet: text(row.outletName) || text(row.outletCode),
      displayPaymentCaption: [text(row.date), text(row.username), text(row.mode)].filter(Boolean).join(' • '),
      displayPaymentAmount: _C(row.amount, true),
      displayPaymentColor: color
    })
  })
}

function Recent (rows = []) {
  return present([...rows]
    .sort((a, b) => (b.recentAt || 0) - (a.recentAt || 0))
    .slice(0, 50))
}

function PendingApproval (rows = []) {
  return present(rows.filter(row => row.isSubmitted).sort(newest))
}

function OverdueInvoices () {
  const recordSource = useRecord()
  return useOutletPaymentIndex().views.value.OverdueInvoices.map(row =>
    decorateRow(recordSource.enrich('OutletConsumptionInvoices', row.code) || row, row)
  )
}

function Outlets () {
  return useOutletPaymentIndex().views.value.Outlets
}

function CompletedPayments (rows = []) {
  return present(rows.filter(row => row.isApproved).sort(newest))
}

function CancelledPayments (rows = []) {
  return present(rows.filter(row => row.isCancelled).sort(newest))
}

export default {
  Recent,
  PendingApproval,
  OverdueInvoices,
  Outlets,
  CompletedPayments,
  CancelledPayments
}
