import { useInvoiceIndex } from '../composables/useInvoiceIndex'
import { PARTIALLY_PAID, PAID, CANCELLED } from '../composables/useInvoiceWorkflow'
import { decorateRow } from 'src/utils/appHelpers'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

const active = (row) => {
  const status = String(row?.Status || '').trim().toUpperCase()
  return !status || status === 'ACTIVE'
}
const progress = (row) => String(row?.progress || row?.Progress || '').trim().toUpperCase()
const updatedAt = (row) => Number(row?.updatedAt) || 0
const dateOf = (row) => String(row?.date || row?.Date || '')
const activeRows = (rows) => (Array.isArray(rows) ? rows : []).filter(active)
const byDateDesc = (a, b) => dateOf(b).localeCompare(dateOf(a))
const text = value => (value == null ? '' : String(value).trim())

function dueText (row, short) {
  const days = row?.dueInDays
  if (days === null || days === undefined) return 'no due date'
  if (days < 0) return `due by ${Math.abs(days)} days`
  if (days === 0) return 'due today'
  return short ? `in ${days} days` : `due in ${days} days`
}

function present (rows) {
  const { _C } = useCurrencyResource()
  return rows.map(row => decorateRow(row, {
    displayInvoiceCode: text(row.code || row.Code),
    displayInvoiceOutlet: text(row.outletName) || text(row.outletCode),
    displayInvoiceDateUser: [text(row.date || row.Date), text(row.username || row.Username)].filter(Boolean).join(' · '),
    displayInvoiceBalance: `Payable: ${_C(row.balance, true)}`,
    displayInvoiceTotal: _C(row.total, true),
    displayDueText: dueText(row, false),
    displayShortDueText: dueText(row, true)
  }))
}

function Recent (rows) {
  return present(activeRows(rows).sort((a, b) => updatedAt(b) - updatedAt(a)).slice(0, 50))
}

function DueIn (rows) {
  return present(activeRows(rows).filter(row => row.isOpen && row.dueInDays != null && row.dueInDays >= 0 && row.dueInDays <= 7)
    .sort((a, b) => a.dueInDays - b.dueInDays))
}

function Overdue (rows) {
  return present(activeRows(rows).filter(row => row.isOverdue).sort((a, b) => a.dueInDays - b.dueInDays))
}

function PartiallyPaid (rows) {
  return present(activeRows(rows).filter(row => progress(row) === PARTIALLY_PAID)
    .sort((a, b) => updatedAt(a) - updatedAt(b)))
}

function Completed (rows) {
  return present(activeRows(rows).filter(row => progress(row) === PAID).sort(byDateDesc))
}

function Cancelled (rows) {
  return present(activeRows(rows).filter(row => progress(row) === CANCELLED).sort(byDateDesc))
}

function OutletPendings () {
  return useInvoiceIndex().runtimeViews.value.OutletPendings
}

function Invoiceable () {
  return useInvoiceIndex().runtimeViews.value.Invoiceable
}

export default { Recent, DueIn, Overdue, PartiallyPaid, OutletPendings, Invoiceable, Completed, Cancelled }
