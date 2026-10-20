import { computed, inject, watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { buildRequisitionInitNodes } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import {
  isPendingApproval, PROGRESS_META, REVIEW_ACTIONS
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

const NODE = 'PurchaseRequisitions'
const OPTIONS = Object.keys(REVIEW_ACTIONS).map((value) => ({ ...PROGRESS_META[value], value }))

export function useRequisitionReviewContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const { getWarehouse } = useWarehouseResource()
  const { skuLabelText } = useSkuResource()
  const { itemsByRequisition, itemSummary } = usePurchaseRequisitionResource()
  const requisition = computed(() => resourceRecord?.record?.value || {})
  const decision = pageState.useRecord('Progress', NODE)
  const approvedComment = pageState.useRecord('ProgressApprovedComment', NODE)
  const revisionComment = pageState.useRecord('ProgressRevisionRequiredComment', NODE)
  const rejectedComment = pageState.useRecord('ProgressRejectedComment', NODE)
  const options = computed(() => isPendingApproval(requisition.value) &&
    resourceConfig?.allowed('review', NODE, requisition.value) ? OPTIONS : [])
  const warehouseName = computed(() => getWarehouse(requisition.value.WarehouseCode)?.name || requisition.value.WarehouseCode || '—')
  const items = computed(() => itemSummary(itemsByRequisition.value.get(requisition.value.Code) || []).items)
  return {
    pageState, resourceRecord, resourceConfig, requisition, decision, approvedComment, revisionComment, rejectedComment,
    options,
    warehouseName, items, skuLabelText, ui: useAQLConfig()
  }
}

export function useRequisitionReviewSeed () {
  const { pageState, requisition } = useRequisitionReviewContext()
  const { user } = useAuth()
  watch(() => requisition.value.Code, (code) => {
    if (code && pageState.getRecord('Code', NODE) === code && pageState.getControls('formMode', '', NODE) === 'review') return
    pageState.resetForResource(NODE)
    if (!code || !isPendingApproval(requisition.value)) return
    pageState.initResource('Procurements')
    pageState.applyNodes(buildRequisitionInitNodes({
      mode: 'review', form: requisition.value,
      actorName: user.value?.name || user.value?.email || '', actorRole: user.value?.role || ''
    }))
  }, { immediate: true })
}
