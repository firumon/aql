import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { isActiveRow } from './useRFQProgress'

export const RESOURCE_NAME = 'RFQs'
export const ITEMS_RESOURCE = 'RFQItems'
export const SUPPLIERS_RESOURCE = 'RFQSuppliers'

const text = (value) => String(value ?? '').trim()

export function rfqItemSummary (rows = []) {
  const items = rows.filter((row) => row && row._action !== 'deactivate' && isActiveRow(row))
  return {
    items, lines: items.length,
    quantity: items.reduce((sum, row) => sum + (Number(row.Quantity) || 0), 0),
    codes: items.map((row) => row.SKU).filter(Boolean)
  }
}

export function useRFQResource () {
  const record = useRecord()
  const shared = record.remember('useRFQResource', () => {
    const { skuLabelOf, getSku } = useSkuResource()
    const summaries = new WeakMap()
    const itemsByRfq = computed(() => new Map([...record.indexOf(ITEMS_RESOURCE, 'RFQCode')]
      .map(([code, rows]) => [code, rows.map((row) => record.enrich(ITEMS_RESOURCE, row.Code) || row)])))
    const linesByRfq = computed(() => new Map([...itemsByRfq.value].map(([code, rows]) => [
      code, rfqItemSummary(rows).items.map((row) => {
        const label = skuLabelOf(text(row.SKU))
        let allocations = row.Allocations || {}
        if (typeof allocations === 'string') {
          try { allocations = JSON.parse(allocations) } catch { allocations = {} }
        }
        if (!allocations || typeof allocations !== 'object' || Array.isArray(allocations)) allocations = {}
        return Object.assign(Object.create(row), {
          ...row, _raw: row, skuRecord: getSku(row.SKU), code: text(row.Code), sku: text(row.SKU),
          primary: label.primary, secondary: label.secondary, uom: text(row.UOM) || label.uom,
          quantity: Number(row.Quantity) || 0, description: text(row.Description), allocations,
          purchaseRequisitionItemCodes: text(row.PurchaseRequisitionItemCodes)
        })
      })
    ])))
    return {
      itemsByRfq, linesByRfq,
      suppliersByRfq: computed(() => record.indexOf(SUPPLIERS_RESOURCE, 'RFQCode')),
      itemSummary: (rows) => {
        if (!summaries.has(rows)) summaries.set(rows, computed(() => rfqItemSummary(rows)))
        return summaries.get(rows).value
      },
      loading: computed(() => [RESOURCE_NAME, ITEMS_RESOURCE, SUPPLIERS_RESOURCE].some(record.isLoading))
    }
  })
  return {
    ...shared,
    getRFQ: (code) => text(code) ? record.recordBy(RESOURCE_NAME, 'Code', text(code)) : null,
    getRFQItem: (code) => text(code) ? record.recordBy(ITEMS_RESOURCE, 'Code', text(code)) : null,
    rfqOfProcurement: (code) => text(code) ? record.recordBy(RESOURCE_NAME, 'ProcurementCode', text(code)) : null,
    rfqSupplierRows: () => record.enriched(SUPPLIERS_RESOURCE),
    linesOf: (code) => shared.linesByRfq.value.get(text(code)) || [],
    suppliersOf: (code) => shared.suppliersByRfq.value.get(text(code)) || []
  }
}
