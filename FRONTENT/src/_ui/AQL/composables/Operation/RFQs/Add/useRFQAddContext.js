import { computed, inject, watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { findResourceConfig } from 'src/composables/resources/useResourceConfig'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { isRfqEligible, typeMeta, priorityMeta } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { joinParts } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Index/usePurchaseRequisitionRowPresets'
import { useRFQFormContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQFormContext'
import { useSupplierResource } from 'src/_resource/Master/Suppliers/composables/useSupplierResource'

const NODE = 'RFQs'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function useRFQAddContext () {
  const base = useRFQFormContext()
  const resourceConfig = inject('resourceConfig', null)
  const { user } = useAuth()

  const requisitions = usePageRecord('PurchaseRequisitions')
  const procurements = usePageRecord('Procurements')

  const { linesByRequisition } = usePurchaseRequisitionResource()
  const { getWarehouse } = useWarehouseResource()
  const { skuLabelOf, getSku } = useSkuResource()
  const { activeChoices: availableSuppliers, getSupplier } = useSupplierResource()
  const showSourceChoice = computed(() => Boolean(findResourceConfig('PurchaseRequisitions')?.permissions?.canRead))

  function control (key) {
    return base.pageState?.getControls(key, null, NODE)
  }

  function setControl (key, value) {
    base.pageState?.setControls(key, value, NODE)
  }

  const sourceType = computed({
    get: () => showSourceChoice.value ? control('SourceType') || 'PR' : 'DIRECT',
    set: (value) => setControl('SourceType', value)
  })

  const isDirectToggle = computed({
    get: () => sourceType.value === 'DIRECT',
    set: (value) => { sourceType.value = value ? 'DIRECT' : 'PR' }
  })

  watch([showSourceChoice, () => control('SourceType')], ([canReadPr, restoredSource]) => {
    if (canReadPr || restoredSource !== 'PR') return
    setControl('SourceType', 'DIRECT')
    setControl('PrListCollapsed', false)
    base.pageState?.setRecord(null, {
      PurchaseRequisitionCode: '',
      ProcurementCode: ''
    }, NODE)
    for (const resource of ['RFQSuppliers', 'PurchaseRequisitions', 'PurchaseRequisitionItems', 'Procurements']) {
      base.pageState?.removeNode(resource)
    }
  }, { immediate: true, flush: 'post' })

  const prListCollapsed = computed({
    get: () => Boolean(control('PrListCollapsed')),
    set: (value) => setControl('PrListCollapsed', Boolean(value))
  })

  const directItems = computed(() => {
    const list = control('DirectItems')
    return Array.isArray(list) ? list.map((item) => ({
      ...item,
      secondary: (getSku(item.sku)?.variantValues || []).filter(Boolean).join(' / ')
    })) : []
  })

  function addDirectSkus (valuesBySkuCode = {}) {
    const currentBySku = new Map(directItems.value.map((item) => [item.sku, item]))
    const current = Object.entries(asRow(valuesBySkuCode)).flatMap(([rawCode, rawQuantity]) => {
      const code = text(rawCode)
      if (!code) return []
      const existing = currentBySku.get(code)
      const quantity = rawQuantity === undefined ? existing?.quantity ?? 1 : Number(rawQuantity) || 0
      if (existing) return [{ ...existing, quantity }]
      const label = skuLabelOf(code)
      const skuObj = getSku(code)
      return [{
        code: `direct:${code}`,
        sku: code,
        primary: label?.primary || code,
        secondary: (skuObj?.variantValues || []).filter(Boolean).join(' / '),
        uom: text(skuObj?.uom) || label?.uom || 'Unit',
        quantity,
        description: ''
      }]
    })
    setControl('DirectItems', current)
  }

  function updateDirectItem (index, updates = {}) {
    const current = [...directItems.value]
    if (index >= 0 && index < current.length) {
      current[index] = { ...current[index], ...updates }
      setControl('DirectItems', current)
    }
  }

  function removeDirectItem (index) {
    const current = [...directItems.value]
    if (index >= 0 && index < current.length) {
      current.splice(index, 1)
      setControl('DirectItems', current)
    }
  }

  const eligibleRequisitions = computed(() => requisitions.items.value
    .map(asRow)
    .filter(isRfqEligible)
    .map((row) => ({
      code: text(row.Code),
      top: joinParts([text(row.Username), text(row.PRDate)]),
      bottom: joinParts([
        typeMeta(row.Type).label,
        priorityMeta(row.Priority).label,
        text(getWarehouse(text(row.WarehouseCode))?.name) || text(row.WarehouseCode)
      ]),
      row
    })))

  const displayedRequisitions = computed(() => {
    if (prListCollapsed.value && selectedRequisitionCode.value) {
      return eligibleRequisitions.value.filter((item) => item.code === selectedRequisitionCode.value)
    }
    return eligibleRequisitions.value
  })

  const selectedRequisitionCode = computed(() => text(base.record.value.PurchaseRequisitionCode))

  const requisition = computed(() => {
    const code = selectedRequisitionCode.value
    if (!code) return null
    return requisitions.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const procurement = computed(() => {
    const code = text(requisition.value?.ProcurementCode)
    if (!code) return null
    return procurements.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const availableItems = computed(() => {
    const code = selectedRequisitionCode.value
    if (!code) return []
    return linesByRequisition.value?.get(code) || []
  })

  const selectedItems = computed(() => {
    if (sourceType.value === 'DIRECT') {
      return directItems.value
    }
    return availableItems.value
  })

  const selectedSupplierCodes = computed(() => {
    const value = control('SelectedSupplierCodes')
    return Array.isArray(value) ? value : []
  })
  const selectedSuppliers = computed(() => selectedSupplierCodes.value.map((code) => getSupplier(code)).filter(Boolean))

  function selectRequisition (code) {
    base.setField('PurchaseRequisitionCode', text(code))
  }

  const selectedRequisition = computed({
    get: () => selectedRequisitionCode.value,
    set: (value) => selectRequisition(value)
  })

  function toggleSupplier (codes) {
    if (Array.isArray(codes)) {
      setControl('SelectedSupplierCodes', codes)
      return
    }
    const code = text(asRow(codes).Code)
    if (!code) return
    setControl('SelectedSupplierCodes', selectedSupplierCodes.value.filter((selectedCode) => selectedCode !== code))
  }

  const totals = computed(() => selectedItems.value.reduce((acc, item) => {
    acc.lines += 1
    acc.quantity += Number(item.quantity) || 0
    return acc
  }, { lines: 0, quantity: 0 }))

  return {
    ...base,
    resourceConfig,
    user,
    showSourceChoice,
    sourceType,
    isDirectToggle,
    prListCollapsed,
    directItems,
    addDirectSkus,
    updateDirectItem,
    removeDirectItem,
    eligibleRequisitions,
    displayedRequisitions,
    selectedRequisition,
    selectedRequisitionCode,
    requisition,
    procurement,
    availableItems,
    selectedItems,
    availableSuppliers,
    selectedSupplierCodes,
    selectedSuppliers,
    selectRequisition,
    toggleSupplier,
    totals
  }
}
