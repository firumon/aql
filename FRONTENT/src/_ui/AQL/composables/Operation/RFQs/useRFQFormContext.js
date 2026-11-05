import { computed, inject } from 'vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useRFQCriteria, buildRFQCriteriaNodes } from 'src/_resource/Operation/RFQs/composables/useRFQCriteria'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { buildRequisitionInitNodes } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'

const NODE = 'RFQs'
const PR_ITEMS = 'PurchaseRequisitionItems'

export function useRFQFormContext () {
  const pageState = inject('pageState', null)
  const ui = useAQLConfig()

  const parent = pageState?.useNode(NODE)
  const itemIndexes = pageState?.useRecordsIndex('Code', PR_ITEMS)
  const record = computed(() => parent?.record?.value || {})
  const criteria = useRFQCriteria()
  const requisitions = usePurchaseRequisitionResource()
  const editing = computed(() => Boolean(parent?.node?.value?.code))
  const currentStep = computed(() => pageState?.meta?.currentStep || 1)
  const stepPlan = computed(() => criteria.stepsOf(record.value, editing.value))
  const snapshot = computed(() => criteria.snapshot(record.value))
  const selectedCriteria = computed(() => snapshot.value.selected)
  const activeCriterion = computed(() => {
    const start = stepPlan.value.criterionStart || 3
    return selectedCriteria.value[currentStep.value - start] || null
  })
  const sheetOptions = computed(() => activeCriterion.value ? criteria.optionsOf(activeCriterion.value) : [])

  function setField (key, value) {
    pageState?.setRecord(key, value, NODE)
  }

  function changeCriterion (operation, id, value, optionIndex) {
    return pageState?.applyNodes(buildRFQCriteriaNodes({ record: record.value, code: parent?.node?.value?.code, operation, id, value, optionIndex,
      catalogue: criteria.catalogue.value }))
  }

  function itemDescription (code) {
    const index = itemIndexes?.value?.[String(code ?? '').trim()]
    return index === undefined
      ? requisitions.getRequisitionItem(code)?.Description || ''
      : pageState?.getRecords(index, 'Description', PR_ITEMS) || ''
  }

  function setItemDescription (code, value) {
    const itemCode = String(code ?? '').trim()
    const index = itemIndexes?.value?.[itemCode]
    if (index !== undefined) {
      pageState?.updateRecord(index, { Description: String(value ?? '') }, PR_ITEMS)
      return
    }
    const purchaseRequisition = requisitions.getPurchaseRequisition(record.value.PurchaseRequisitionCode)
    const item = requisitions.getRequisitionItem(itemCode)
    if (!purchaseRequisition || item?.PurchaseRequisitionCode !== purchaseRequisition.Code || item.Status !== 'Active') return
    pageState?.applyNodes(buildRequisitionInitNodes({ mode: 'descriptions', form: purchaseRequisition,
      items: [{ ...item, Description: value }] }))
  }

  return {
    pageState,
    ui,
    record,
    setField,
    currentStep, editing, stepPlan, selectedCriteria, activeCriterion, sheetOptions,
    catalogue: criteria.catalogue, criteriaReady: criteria.ready,
    criteriaErrors: computed(() => snapshot.value.errors),
    itemDescription, setItemDescription,
    requisitionItems: computed(() => requisitions.linesByRequisition.value.get(record.value.PurchaseRequisitionCode) || []),
    itemsLoading: requisitions.loading,
    criterionTerms: computed(() => criteria.termsOf(record.value)),
    changeCriterion
  }
}
