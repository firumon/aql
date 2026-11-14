const text = value => (value == null ? '' : String(value).trim())

export default function (row) {
  return {
    displayInvoiceableOutlet: text(row.outletName) || text(row.outletCode),
    displayInvoiceableCount: `Consumptions: ${row.consumptionCount}`
  }
}
