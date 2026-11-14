import { useConsumptionIndex } from '../composables/useConsumptionIndex'
import { decorateRow } from 'src/utils/appHelpers'
import {
  CANCELLED,
  INVOICE_GENERATED,
  PENDING_INVOICE_GENERATION,
  isActiveRow,
  isCancelled,
  progressOf,
  progressColor,
  progressLabel,
  recentConsumptionsList,
  settledAt,
  sortByDate
} from '../composables/useConsumptionProgress'

const rowsOf = (rows) => Array.isArray(rows) ? rows : []
const text = value => (value == null ? '' : String(value).trim())

function formatDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function present (rows) {
  return rows.map(row => {
    const progress = progressOf(row)
    return decorateRow(row, {
      displayConsumptionOutlet: text(row?.OutletName) || text(row?.$outlet?.Name) || text(row?.OutletCode) || 'Unknown outlet',
      displayConsumptionDate: formatDate(row?.Date),
      displayConsumptionProgress: progressLabel(progress),
      displayConsumptionProgressColor: progressColor(progress)
    })
  })
}

function recent (rows) {
  return present(recentConsumptionsList(rowsOf(rows)
    .filter((row) => !isCancelled(row)))
    .slice(0, 50))
}

function invoiceable (rows) {
  return present(sortByDate(
    rowsOf(rows).filter((row) => isActiveRow(row) &&
      progressOf(row) === PENDING_INVOICE_GENERATION && !row?.isInvoiced),
    (row) => row?.ProgressPendingInvoiceGenerationAt || row?.Date,
    'asc'
  ))
}

function completed (rows) {
  return present(sortByDate(
    rowsOf(rows).filter((row) => isActiveRow(row) &&
      progressOf(row) === INVOICE_GENERATED),
    settledAt,
    'desc'
  ))
}

function cancelled (rows) {
  return present(sortByDate(
    rowsOf(rows).filter((row) => isActiveRow(row) &&
      progressOf(row) === CANCELLED),
    settledAt,
    'desc'
  ))
}

function InvoiceableOutlets () {
  return useConsumptionIndex().invoiceableOutlets.value
}

export default {
  default: (rows) => rowsOf(rows),
  Recent: recent,
  Invoiceable: invoiceable,
  InvoiceableOutlets,
  Completed: completed,
  Cancelled: cancelled
}
