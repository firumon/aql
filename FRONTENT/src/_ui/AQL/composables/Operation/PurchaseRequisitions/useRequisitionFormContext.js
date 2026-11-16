import { computed, inject, watch } from 'vue'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { useAuth } from 'src/composables/core/useAuth'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import {
  syncRequisitionItems, buildRequisitionInitNodes
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import {
  isEditable, canEditRequisition, isOwnedBy, progressOf
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

export { buildRequisitionInitNodes }

const NODE = 'PurchaseRequisitions'
const CHILD = 'PurchaseRequisitionItems'

export function useRequisitionFormContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()
  const rfqConfig = useResourceConfig('RFQs')
  const { skuLabelText, getSku } = useSkuResource()
  const { itemSummary } = usePurchaseRequisitionResource()
  const parent = pageState?.useNode(NODE)
  const record = computed(() => parent?.record?.value || {})
  const form = record
  const progress = computed(() => progressOf(record.value))
  const isNew = computed(() => !record.value.Code)
  const source = computed(() => resourceRecord?.record?.value || record.value)
  const editable = computed(() => record.value.Code ? canEditRequisition(source.value, user.value?.id, {
    updateAllowed: resourceConfig?.allowed?.('update', NODE, source.value), rfqCreateAllowed: rfqConfig.allowed('create')
  }) : isEditable(record.value))
  const remarksRequired = computed(() => !!source.value.Code && !isOwnedBy(source.value, user.value?.id))
  const childIndexes = pageState?.useChildrenIndex(CHILD, 'SKU', NODE)
  const childRows = parent?.children(CHILD)
  const summary = computed(() => itemSummary(childRows?.value || []))
  const items = computed(() => summary.value.items)

  function updateItem (index, patch) {
    if (editable.value) pageState?.updateChild(CHILD, index, patch, NODE)
  }

  function removeItem (index) {
    if (!pageState || !editable.value) return
    const row = pageState.getChildRows(CHILD, NODE)[index]
    if (!row) return
    if (row.Code) pageState.setChildAction(CHILD, index, 'deactivate', NODE)
    else pageState.removeChild(CHILD, index, NODE)
  }

  function addItems (values = {}) {
    if (!pageState || !editable.value) return
    const codes = Object.keys(values)
    const selectedSkus = codes.map((code) => getSku(code)?._raw || getSku(code)).filter(Boolean)
    syncRequisitionItems(pageState, selectedSkus, codes)
    const indexes = childIndexes?.value || {}
    for (const code of codes) {
      const index = indexes[code]
      if (index === undefined) continue
      const quantity = Number(values[code])
      updateItem(index, { Quantity: Number.isFinite(quantity) ? quantity : 0 })
    }
  }

  const skuQuantities = computed(() => Object.fromEntries(items.value.map((item) => [item.SKU, item.Quantity])))
  const existingCodes = computed(() => summary.value.codes)
  const totalQuantity = computed(() => summary.value.quantity)

  return {
    pageState, resourceRecord, resourceConfig, ui, user, parent, record, form,
    requiredDate: pageState?.useRecord('RequiredDate', NODE),
    remarks: pageState?.useRecord('Remarks', NODE), remarksRequired,
    progress, editable, isNew, items, childIndexes, updateItem, removeItem, addItems,
    existingCodes, skuQuantities, totalQuantity, skuLabelText
  }
}

export function useRequisitionFormSeed ({ pageState, resourceRecord, resourceConfig }, mode = 'edit') {
  const { user } = useAuth()
  const rfqConfig = useResourceConfig('RFQs')
  const { getPurchaseRequisition, itemsByRequisition, loading } = usePurchaseRequisitionResource()
  let seededCode = ''
  let seededItems = false
  watch([
    () => resourceRecord?.record?.value?.Code, itemsByRequisition, loading
  ], ([code]) => {
    if (!pageState || !code || loading.value) return
    const source = getPurchaseRequisition(code)
    if (!source || !canEditRequisition(source, user.value?.id, {
      updateAllowed: resourceConfig?.allowed?.('update', NODE, source), rfqCreateAllowed: rfqConfig.allowed('create')
    })) return
    const rows = itemsByRequisition.value.get(code) || []
    if (code === seededCode) {
      if (!seededItems && rows.length) {
        pageState.applyNodes(buildRequisitionInitNodes({
          form: source, items: rows, mode: 'items', currentItems: pageState.getChildRows(CHILD, NODE)
        }))
        seededItems = true
      }
      return
    }
    seededCode = code
    seededItems = rows.length > 0
    pageState.resetForResource(NODE)
    pageState.applyNodes(buildRequisitionInitNodes({
      form: source, items: rows, mode, actorName: user.value?.name || user.value?.email || ''
    }))
  }, { immediate: true })
}
