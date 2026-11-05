import { computed, inject, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { useAuth } from 'src/composables/core/useAuth'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import {
  syncRequisitionItems,
  buildRequisitionInitNodes
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import {
  isEditable,
  isRevisionRequired,
  DRAFT,
  typeMeta,
  priorityMeta
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

export {
  buildRequisitionInitNodes
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'

export {
  TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  typeMeta,
  priorityMeta
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

const NODE = 'PurchaseRequisitions'
const CHILD = 'PurchaseRequisitionItems'

export function useRequisitionFormContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()
  const { warehouseOptions, getWarehouse } = useWarehouseResource()
  const { skuLabelText, getSku } = useSkuResource()
  const { itemSummary, getPurchaseRequisition } = usePurchaseRequisitionResource()

  const parent = pageState?.useNode(NODE)
  const record = computed(() => parent?.record?.value || {})
  const form = record
  const progress = computed(() => pageState?.getControls('entryProgress', DRAFT, NODE))
  const sourceRecord = computed(() => resourceRecord?.record?.value?.Code ? resourceRecord.record.value :
    getPurchaseRequisition(pageState?.getControls('selectedCode', '', NODE)))
  const editable = computed(() => !sourceRecord.value?.Code ||
    (isEditable(sourceRecord.value) && resourceConfig?.allowed('update', NODE, sourceRecord.value)))
  const isRevision = computed(() => isRevisionRequired({ Progress: progress.value }))
  const isNew = computed(() => !record.value.Code)
  const isDraftState = computed(() => isNew.value || progress.value === DRAFT)
  const isDraft = computed(() => pageState?.getControls('isDraft', null, NODE) === true)
  const canApprove = computed(() => {
    try {
      return resourceConfig?.allowed?.('review', NODE, record.value) === true
    } catch {
      return false
    }
  })
  const isApproved = computed(() => {
    if (!canApprove.value || isDraft.value) return false
    return pageState?.getControls('isApproved', false, NODE) === true
  })
  const currentStep = computed(() => pageState?.meta?.currentStep || 1)

  const childIndexes = pageState?.useChildrenIndex(CHILD, 'SKU', NODE)
  const childRows = parent?.children(CHILD)
  const summary = computed(() => itemSummary(childRows?.value || []))
  const items = computed(() => summary.value.items)

  function setDraft (value) {
    pageState?.setControls('isDraft', value === true, NODE)
  }

  function setApproved (value) {
    if (canApprove.value && !isDraft.value) pageState?.setControls('isApproved', value === true, NODE)
  }

  function updateItem (index, patch) {
    if (pageState) {
      pageState.updateChild(CHILD, index, patch, NODE)
    }
  }

  function removeItem (index) {
    if (pageState) {
      const row = parent?.children(CHILD)?.value?.[index]
      if (row?.Code) pageState.setChildAction(CHILD, index, 'deactivate', NODE)
      else pageState.removeChild(CHILD, index, NODE)
    }
  }

  function addItems (values) {
    if (!editable.value) return
    const codes = Object.keys(values)
    const selectedSkus = codes.map((code) => getSku(code)?._raw).filter(Boolean)
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

  const warehouseName = computed(() => {
    const code = record.value.WarehouseCode
    if (!code) return ''
    const wh = getWarehouse(code)
    return wh ? [wh.code, wh.name].filter(Boolean).join(' · ') : code
  })

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    ui,
    user,
    parent,
    record,
    form,
    prType: pageState?.useRecord('Type', NODE),
    prPriority: pageState?.useRecord('Priority', NODE),
    requiredDate: pageState?.useRecord('RequiredDate', NODE),
    warehouseCode: pageState?.useRecord('WarehouseCode', NODE),
    progress,
    editable,
    isRevision,
    isNew,
    isDraftState,
    isDraft,
    canApprove,
    isApproved,
    setApproved,
    currentStep,
    items,
    childIndexes,
    setDraft,
    updateItem,
    removeItem,
    addItems,
    existingCodes,
    skuQuantities,
    totalQuantity,
    warehouseOptions,
    getWarehouse,
    warehouseName,
    skuLabelText,
    typeMeta,
    priorityMeta
  }
}

export function useRequisitionFormSeed (mode = 'edit') {
  const { pageState, resourceRecord, resourceConfig, user, canApprove } = useRequisitionFormContext()
  const route = useRoute()
  const { getPurchaseRequisition, itemsByRequisition, loading } = usePurchaseRequisitionResource()
  const selectedCode = pageState.useControls('selectedCode', '', NODE)
  let seededCode = ''
  let seededItems = false
  if (mode === 'revisions') {
    watch(() => route.query.code, (code) => {
      selectedCode.value = String(code || '')
    }, { immediate: true })
  }
  watch([
    () => mode === 'revisions' ? selectedCode.value : resourceRecord?.record?.value?.Code,
    () => mode === 'revisions' ? getPurchaseRequisition(selectedCode.value)?.Code : resourceRecord?.record?.value?.Code,
    itemsByRequisition, loading
  ], ([code]) => {
    if (!code || loading.value) return
    const source = getPurchaseRequisition(code)
    if (!source || !isEditable(source) || (mode === 'revisions' && !isRevisionRequired(source))) return
    if (!resourceConfig?.allowed('update', NODE, source)) return
    const rows = itemsByRequisition.value.get(code) || []
    const current = pageState.getRecord(null, NODE)
    if (code === seededCode || (current?.Code === code && pageState.getControls('formMode', '', NODE) === mode)) {
      seededCode = code
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
    pageState.initResource('Procurements')
    pageState.applyNodes(buildRequisitionInitNodes({
      form: source, items: rows, mode, canApprove: canApprove.value,
      actorName: user.value?.name || user.value?.email || '', actorRole: user.value?.role || ''
    }))
  }, { immediate: true })
}
