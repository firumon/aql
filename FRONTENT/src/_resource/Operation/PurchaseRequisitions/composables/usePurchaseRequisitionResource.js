import { computed } from 'vue'
import { isRevisionRequired, isActiveRow } from './usePurchaseRequisitionProgress'
import { useRecord } from 'src/composables/resources/useRecord'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'

const RESOURCE_NAME = 'PurchaseRequisitions'

const text = (value) => String(value ?? '').trim()

export { RESOURCE_NAME }

export function requisitionItemSummary (rows = []) {
  const items = rows.filter((row) => row && row._action !== 'deactivate' && isActiveRow(row))
  return {
    items, lines: items.length,
    quantity: items.reduce((sum, row) => sum + (Number(row.Quantity) || 0), 0),
    codes: items.map((row) => row.SKU).filter(Boolean)
  }
}

export function usePurchaseRequisitionResource () {
  const record = useRecord()
  const shared = record.remember('usePurchaseRequisitionResource', () => {
    const { skuLabelOf, getSku } = useSkuResource()
    const summaries = new WeakMap()
    const itemsByRequisition = computed(() => new Map(
      [...record.indexOf('PurchaseRequisitionItems', 'PurchaseRequisitionCode')]
        .map(([code, rows]) => [code, rows.map((row) => record.enrich('PurchaseRequisitionItems', row.Code) || row)])
    ))
    const linesByRequisition = computed(() => new Map([...itemsByRequisition.value].map(([code, rows]) => [
      code, requisitionItemSummary(rows).items.map((row) => {
        const label = skuLabelOf(text(row.SKU))
        return Object.assign(Object.create(row), {
          ...row, _raw: row, skuRecord: getSku(row.SKU), code: text(row.Code), sku: text(row.SKU),
          primary: label.primary, secondary: label.secondary, uom: text(row.UOM) || label.uom,
          quantity: Number(row.Quantity) || 0
        })
      })
    ])))
    return {
      revisionRequired: computed(() => record.enriched(RESOURCE_NAME).filter((row) => isActiveRow(row) && isRevisionRequired(row))),
      itemsByRequisition, linesByRequisition,
      itemSummary: (rows) => {
        if (!summaries.has(rows)) summaries.set(rows, computed(() => requisitionItemSummary(rows)))
        return summaries.get(rows).value
      },
      loading: computed(() => record.isLoading(RESOURCE_NAME) || record.isLoading('PurchaseRequisitionItems'))
    }
  })

  const getPurchaseRequisition = (code) => {
    const key = text(code)
    if (!key) return null
    return record.recordBy(RESOURCE_NAME, 'Code', key)
  }

  const getRequisitionItem = (code) => {
    const key = text(code)
    if (!key) return null
    return record.recordBy('PurchaseRequisitionItems', 'Code', key)
  }

  const requisitionItemsByCodes = (codes) => {
    if (!Array.isArray(codes)) return []
    return codes.map(getRequisitionItem).filter(Boolean)
  }

  return {
    ...shared,
    getPurchaseRequisition,
    getRequisitionItem,
    requisitionItemsByCodes
  }
}
