import { buildRFQItemSelectionNodes } from 'src/_resource/Operation/RFQs/composables/useRFQPayload'
import { computed, inject } from 'vue'
import { daysFromToday } from 'src/utils/dateHelpers'
import { decorateRow } from 'src/utils/appHelpers'
import { isEditable } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'
import { findResourceConfig } from 'src/composables/resources/useResourceConfig'
import useRequisitionQueueData from 'src/_resource/Operation/PurchaseRequisitions/Data/useRequisitionQueueData'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useSupplierResource } from 'src/_resource/Master/Suppliers/composables/useSupplierResource'
import { useRFQFormContext } from '../useRFQFormContext'

const NODE = 'RFQs'
export function useRFQAddContext () {
  const base = useRFQFormContext()
  const original = inject('resourceRecord', null)
  const queue = useRequisitionQueueData()
  const requisitions = usePurchaseRequisitionResource()
  const skus = useSkuResource()
  const suppliers = useSupplierResource()
  const childIndexes = base.pageState.useChildrenIndex('RFQItems', 'SKU', NODE)
  const rows = computed(() => base.pageState.getChildRows('RFQItems', NODE))
  const selectedItems = computed(() => rows.value.filter(row => row._action !== 'deactivate').map(row => ({
    ...row, sku: row.SKU, code: row.Code || row.SKU, primary: skus.skuLabelOf(row.SKU).primary,
    quantity: row.Quantity, uom: row.UOM, description: row.Description
  })))
  const selectedSupplierCodes = computed(() => base.pageState.getControls('SelectedSupplierCodes', [], NODE))
  function toggleSupplier (codes) {
    base.pageState.setControls('SelectedSupplierCodes', Array.isArray(codes) ? codes
      : selectedSupplierCodes.value.filter(code => code !== codes.Code), NODE)
  }
  function addDirectSkus (values) {
    base.pageState.applyNodes(buildRFQItemSelectionNodes({ items: rows.value, selection: values }))
  }
  function updateDirectItem (index, updates) {
    base.pageState.updateChild('RFQItems', index, updates, NODE)
  }
  function removeDirectItem (sku) {
    if (base.locked.value) return
    const index = childIndexes.value[sku]
    if (index === undefined) return
    const row = rows.value[index]
    if (row.Code) base.pageState.setChildAction('RFQItems', index, 'deactivate', NODE)
    else base.pageState.removeChild('RFQItems', index, NODE)
  }
  function selectRequisition (codes) { base.setField('PurchaseRequisitionCodes', codes.join(',')) }
  const skuQuantities = computed(() => Object.fromEntries(selectedItems.value.map(item => [item.sku, item.quantity])))
  return { ...base, childIndexes, skuQuantities, removeDirectItem, skuLabelOf: skus.skuLabelOf,
    locked: computed(() => base.editing.value && !isEditable(original?.record?.value)), selectedItems, directItems: selectedItems,
    rows, addDirectSkus, updateDirectItem, selectRequisition,
    showSourceChoice: computed(() => Boolean(findResourceConfig('PurchaseRequisitions')?.permissions?.canRead)),
    eligibleRequisitions: computed(() => {
      const rows = new Map(queue.pendingRequisitions.value.map(row => [row.Code, row]))
      for (const code of String(base.record.value.PurchaseRequisitionCodes || '').split(',')) {
        const row = requisitions.getPurchaseRequisition(code)
        if (row) rows.set(code, row)
      }
      return [...rows.values()].map((row) => {
        const days = daysFromToday(row.RequiredDate)
        const dueLabel = Number.isNaN(days) ? '' : days > 0 ? `Within ${days} day${days === 1 ? '' : 's'}`
          : days === 0 ? 'Due today' : `Overdue ${Math.abs(days)}d`
        return decorateRow(row, {
          chip: dueLabel, dueColor: days < 0 ? 'negative' : days <= 3 ? 'warning' : 'primary',
          caption: [row.PRDate, row.Username].filter(Boolean).join(' \u2022 ')
        })
      })
    }),
    selectedRequisitionCodes: computed(() => String(base.record.value.PurchaseRequisitionCodes || '').split(',').filter(Boolean)),
    availableSuppliers: suppliers.activeChoices, selectedSupplierCodes,
    selectedSuppliers: computed(() => selectedSupplierCodes.value.map(suppliers.getSupplier).filter(Boolean)), toggleSupplier
  }
}
