import { computed } from 'vue'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { isRevisionRequired } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'
import { useRequisitionFormContext, TYPE_OPTIONS, PRIORITY_OPTIONS } from '../useRequisitionFormContext'

const NODE = 'PurchaseRequisitions'

export function useRequisitionRevisionContext () {
  const form = useRequisitionFormContext()
  const { pageState, items } = form
  const { getPurchaseRequisition, revisionRequired, loading } = usePurchaseRequisitionResource()
  const selectedCode = pageState.useControls('selectedCode', '', NODE)
  const selectedCodeArray = computed({
    get: () => selectedCode.value ? [selectedCode.value] : [],
    set: (value) => { selectedCode.value = Array.isArray(value) ? value.at(-1) || '' : value || '' }
  })
  const selectedRecord = computed(() => {
    const record = getPurchaseRequisition(selectedCode.value)
    return isRevisionRequired(record) && form.resourceConfig?.allowed('update', NODE, record) ? record : null
  })
  const revisionRequiredPRs = computed(() => revisionRequired.value.filter((row) => form.resourceConfig?.allowed('update', NODE, row)))
  const itemIndex = form.childIndexes

  function updateItemQty (item, value) {
    const index = itemIndex.value[item.SKU]
    if (index !== undefined) form.updateItem(index, { Quantity: Number(value) })
  }

  function removeItem (item) {
    const index = itemIndex.value[item.SKU]
    if (index !== undefined) form.removeItem(index)
  }

  return {
    ...form, loading, selectedCode, selectedCodeArray, selectedRecord, revisionRequiredPRs,
    responseComment: pageState.useControls('responseComment', '', NODE),
    prType: pageState.useRecord('Type', NODE), prPriority: pageState.useRecord('Priority', NODE),
    approverComment: computed(() => selectedRecord.value?.ProgressRevisionRequiredComment || ''),
    approverBy: computed(() => selectedRecord.value?.ProgressRevisionRequiredBy || ''),
    approverAt: computed(() => selectedRecord.value?.ProgressRevisionRequiredAt || ''),
    canSubmit: computed(() => Boolean(selectedRecord.value && items.value.length)),
    typeOptions: TYPE_OPTIONS, priorityOptions: PRIORITY_OPTIONS, updateItemQty, removeItem
  }
}
