import { isEditable } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { useResourceConfig, findResourceConfig } from 'src/composables/resources/useResourceConfig'
import { computed, inject, onMounted, watch } from 'vue'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useRFQResource } from 'src/_resource/Operation/RFQs/composables/useRFQResource'
import { buildRFQFormInitNodes } from 'src/_resource/Operation/RFQs/composables/useRFQForm'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useRFQRequirements, buildRFQRequirementsNodes } from 'src/_resource/Operation/RFQs/composables/useRFQRequirements'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'

const NODE = 'RFQs'
const PR_ITEMS = 'RFQItems'
const reloaded = new WeakSet()

export function useRFQFormContext () {
  const pageState = inject('pageState', null)
  const original = inject('resourceRecord', null)
  const ui = useAQLConfig()
  const config = useResourceConfig(NODE)
  const warehouses = useWarehouseResource()
  onMounted(() => {
    if (!pageState || reloaded.has(pageState)) return
    reloaded.add(pageState)
    return Promise.all(['RFQItems', 'RFQSuppliers', 'PurchaseRequisitions',
      'PurchaseRequisitionItems', 'SKUs', 'Products', 'Suppliers', 'Warehouses']
      .filter(name => findResourceConfig(name)?.permissions?.canRead !== false)
      .map(name => usePageRecord(name).reload()))
  })

  const parent = pageState?.useNode(NODE)
  const record = computed(() => parent?.record?.value || {})
  const criteria = useRFQRequirements()
  const requisitions = usePurchaseRequisitionResource()
  const editing = computed(() => Boolean(parent?.node?.value?.code))
  const currentStep = computed(() => pageState?.meta?.currentStep || 1)
  const stepPlan = computed(() => criteria.stepsOf(record.value, editing.value))
  const snapshot = computed(() => criteria.snapshot(record.value))
  const selectedCriteria = computed(() => snapshot.value.selected)
  const criteriaById = computed(() => new Map(selectedCriteria.value.map((entry) => [entry.id, entry])))
  const weightOf = (id) => criteriaById.value.get(id)?.weight ?? 0
  const activeCriterion = computed(() => {
    const start = stepPlan.value.criterionStart || 3
    return selectedCriteria.value[currentStep.value - start] || null
  })
  const sheetOptions = computed(() => activeCriterion.value ? criteria.optionsOf(activeCriterion.value) : [])

  function setField (key, value) {
    pageState?.setRecord(key, value, NODE)
  }

  function changeCriterion (operation, id, value, optionIndex) {
    const nodes = buildRFQRequirementsNodes({ record: record.value, code: parent?.node?.value?.code, operation, id, value, optionIndex,
      catalogue: criteria.catalogue.value })
    const failed = nodes.find((node) => node.valid === false)
    const errors = { ...(pageState?.getControls('RequirementInputErrors', {}, NODE) || {}) }
    const key = `${id}:${operation}:${optionIndex ?? ''}`

    if (['set-weight', 'weight', 'option-points'].includes(operation)) {
      if (failed) errors[key] = { step: currentStep.value, message: failed.message }
      else delete errors[key]
    }
    if (operation === 'remove-option' && !failed) delete errors[`${id}:option-points:${optionIndex ?? ''}`]
    if (!failed && (operation === 'select' || (operation === 'set-weight' &&
      [0, '0', '', null, undefined].includes(value)))) {
      for (const errorKey of Object.keys(errors)) {
        if (errorKey.startsWith(`${id}:`)) delete errors[errorKey]
      }
    }

    pageState?.setControls('RequirementInputErrors', errors, NODE)
    return pageState?.applyNodes(nodes)
  }


  return {
    locked: computed(() => editing.value && !isEditable(original?.record?.value)),
    fields: computed(() => ['QuotationSubmissionDeadline', 'RequiredBy', 'WarehouseCode', 'Type',
      'TypeReferenceCode', 'Priority', 'Remarks'].map(name => ({ name,
        label: ({ QuotationSubmissionDeadline: 'Quotation Submission Deadline',
          RequiredBy: 'Required By', WarehouseCode: 'Warehouse', TypeReferenceCode: 'Type Reference' })[name]
          || name,
        fieldType: ['QuotationSubmissionDeadline', 'RequiredBy'].includes(name) ? 'date'
          : ['WarehouseCode', 'Type', 'Priority'].includes(name) ? 'select' : name === 'Remarks' ? 'textarea' : 'text',
        options: name === 'WarehouseCode' ? warehouses.warehouseOptions.value : config.options(name)
      }))),
    pageState,
    ui,
    record,
    setField,
    currentStep, editing, stepPlan, selectedCriteria, weightOf, activeCriterion, sheetOptions,
    catalogue: criteria.catalogue, criteriaReady: criteria.ready,
    criteriaErrors: computed(() => snapshot.value.errors),
    requisitionItems: computed(() => pageState?.getChildRows(PR_ITEMS, NODE) || []),
    itemsLoading: requisitions.loading,
    criterionTerms: computed(() => criteria.termsOf(record.value)),
    changeCriterion
  }
}

export function useRFQFormSeed ({ pageState, resourceRecord }) {
  const { getRFQ, itemsByRfq, loading } = useRFQResource()
  let seededCode = ''
  let seededItems = false
  watch([() => resourceRecord?.record?.value?.Code, itemsByRfq, loading], ([code]) => {
    if (!pageState || !code || loading.value) return
    const source = getRFQ(code) || resourceRecord?.record?.value
    const rows = itemsByRfq.value.get(code) || []
    if (code === seededCode) {
      if (!seededItems && rows.length) {
        seededItems = true
        pageState.applyNodes(buildRFQFormInitNodes({ rfq: source, items: rows }))
      }
      return
    }
    seededCode = code
    seededItems = rows.length > 0
    pageState.resetForResource(NODE)
    pageState.applyNodes(buildRFQFormInitNodes({ rfq: source, items: rows }))
  }, { immediate: true })
}
