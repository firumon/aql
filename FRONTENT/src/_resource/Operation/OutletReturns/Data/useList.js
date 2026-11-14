import { decorateRow } from 'src/utils/appHelpers'
import {
  isActiveRow,
  isCancelled,
  isCompleted,
  isOpen,
  isSubmitted,
  invoiceAdjustmentRequired,
  invoiceAdjustmentDone,
  warehouseActionRequired,
  warehouseActionCompleted,
  progressColor,
  progressLabel,
  progressOf,
  sortByDate
} from '../composables/useReturnProgress'

const asList = (rows) => (Array.isArray(rows) ? rows : [])
const text = value => (value == null ? '' : String(value).trim())
const lastMovedAt = (row) => row?.UpdatedAt || row?.CreatedAt || row?.Date

function present (rows) {
  return rows.map(row => {
    const sku = row?.$sku
    const product = sku?.$product?.Name || sku?.Name || text(row?.SKU)
    const variants = [sku?.Variant1, sku?.Variant2, sku?.Variant3, sku?.Variant4, sku?.Variant5]
      .map(text).filter(Boolean).join(' / ')
    const qty = Math.abs(Number(row?.Qty) || 0)
    const item = variants ? `${product} ${variants}` : text(product)

    return decorateRow(row, {
      displayReturnOutlet: row?.$outlet?.Name || text(row?.OutletCode) || text(row?.Code),
      displayReturnDateUser: [text(row?.Date), text(row?.Username)].filter(Boolean).join(' • '),
      displayReturnItem: `${qty}x ${item}`,
      displayReturnProgressLabel: progressLabel(progressOf(row)),
      displayReturnProgressColor: progressColor(progressOf(row))
    })
  })
}

function selectedRows (rows, matches, direction, field = 'Date') {
  return present(sortByDate(
    asList(rows).filter(isActiveRow).filter(matches),
    field,
    direction
  ))
}

function recent (rows) {
  return present(sortByDate(
    asList(rows).filter(isActiveRow).filter((row) => !isCancelled(row)),
    lastMovedAt,
    'desc'
  ))
}

function awaitingInvoiceAdjustment (rows) {
  return selectedRows(rows, (row) =>
    isOpen(row) && invoiceAdjustmentRequired(row) && !invoiceAdjustmentDone(row), 'asc')
}

function awaitingWarehouseReceipt (rows) {
  return selectedRows(rows, (row) =>
    isOpen(row) && warehouseActionRequired(row) && !warehouseActionCompleted(row), 'asc')
}

export default {
  default: (rows) => asList(rows),
  Recent: recent,
  Submitted: (rows) => selectedRows(rows, isSubmitted, 'asc'),
  AwaitingInvoiceAdjustment: awaitingInvoiceAdjustment,
  AwaitingWarehouseReceipt: awaitingWarehouseReceipt,
  Completed: (rows) => selectedRows(rows, isCompleted, 'desc'),
  Cancelled: (rows) => selectedRows(rows, isCancelled, 'desc')
}
