import { computed, inject, onMounted } from 'vue'
import { useSupplierResource } from 'src/_resource/Master/Suppliers/composables/useSupplierResource'
import { useAuth } from 'src/composables/core/useAuth'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import {
  activeSupplierRowsOf,
  canAssignSuppliers,
  supplierRowsOf,
  progressLabel,
  progressColor,
  supplierProgressLabel,
  supplierProgressColor,
  SUPPLIER_RESPONDED
} from 'src/_resource/Operation/RFQs/composables/useRFQProgress'

const NODE = 'RFQs'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function useRFQSupplierFlowContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()
  const { code: routeCode } = useRouteConfig()

  const rfqs = usePageRecord(NODE)
  const rfqSuppliers = usePageRecord('RFQSuppliers')
  const suppliersPageRecord = usePageRecord('Suppliers')
  const suppliers = useSupplierResource()
  const procurements = usePageRecord('Procurements')

  onMounted(() => {
    ;[rfqs, rfqSuppliers, suppliersPageRecord, procurements].forEach((resource) => resource.reload())
  })

  const rfq = computed(() => {
    const code = text(routeCode?.value)
    if (!code) return null
    return rfqs.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const loading = computed(() => rfqs.loading?.value === true)
  const pending = computed(() => !rfq.value && loading.value)

  const procurement = computed(() => {
    const code = text(rfq.value?.ProcurementCode)
    if (!code) return null
    return procurements.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const assignedRows = computed(() => activeSupplierRowsOf(rfq.value, rfqSuppliers.items.value))

  const assignedDetails = computed(() => assignedRows.value.map((row) => {
    const master = suppliers.getSupplier(row.SupplierCode) || {}
    return {
      code: text(row.Code), supplierCode: text(row.SupplierCode),
      name: text(master.Name) || text(row.SupplierCode), country: text(master.Country),
      contact: text(master.ContactPerson), sentDate: text(row.SentDate), progress: text(row.Progress).toUpperCase()
    }
  }))
  const allSupplierRows = computed(() => supplierRowsOf(rfq.value, rfqSuppliers.items.value).map((row) => {
    const master = suppliers.getSupplier(row.SupplierCode) || {}
    const progress = text(row.Progress).toUpperCase()
    return {
      code: text(row.Code), supplierCode: text(row.SupplierCode),
      name: text(master.Name) || text(row.SupplierCode), country: text(master.Country),
      contact: text(master.ContactPerson), sentDate: text(row.SentDate),
      sentComment: text(row.ProgressSentComment), respondedComment: text(row.ProgressRespondedComment),
      cancelledComment: text(row.ProgressCancelledComment), progress, locked: progress === SUPPLIER_RESPONDED
    }
  }))
  const availableSuppliers = computed(() => {
    const taken = new Set(allSupplierRows.value.map((row) => row.supplierCode))
    return suppliers.activeChoices.value.filter((row) => !taken.has(row.code))
  })
  const selectedSupplierCodes = computed(() => {
    const codes = pageState?.getControls('SelectedNewSupplierCodes', [])
    return Array.isArray(codes) ? codes : []
  })
  const pendingStatusByCode = computed(() => {
    const statuses = pageState?.getControls('PendingSupplierStatuses', {})
    return statuses && typeof statuses === 'object' && !Array.isArray(statuses) ? statuses : {}
  })
  const cancellationReason = computed({
    get: () => pageState?.getControls('SupplierCancelReason', '') ?? '',
    set: (value) => pageState?.setControls('SupplierCancelReason', value ?? '')
  })
  const hasPendingStatusChanges = computed(() => Object.keys(pendingStatusByCode.value).length > 0)
  const hasPendingCancellation = computed(() => Object.values(pendingStatusByCode.value).includes('CANCELLED'))
  const hasSelectedNewSuppliers = computed(() => selectedSupplierCodes.value.length > 0)

  function setSelectedSupplierCodes (codes) {
    if (hasPendingStatusChanges.value) return
    pageState?.setControls('SelectedNewSupplierCodes', [...new Set(Array.isArray(codes) ? codes : [])])
  }

  function effectiveProgress (row) {
    return pendingStatusByCode.value[row.code] || row.progress
  }

  function setRowTargetStatus (row, next) {
    if (!canManage.value || row.locked || hasSelectedNewSuppliers.value) return
    const nextMap = { ...pendingStatusByCode.value }
    if (next === row.progress) delete nextMap[row.code]
    else nextMap[row.code] = next
    pageState?.setControls('PendingSupplierStatuses', nextMap)
    if (!Object.values(nextMap).includes('CANCELLED')) cancellationReason.value = ''
  }

  function resetStatusSelection () {
    pageState?.setControls('PendingSupplierStatuses', {})
    pageState?.setControls('SupplierCancelReason', '')
  }

  function resetNewSupplierSelection () {
    pageState?.setControls('SelectedNewSupplierCodes', [])
  }

  const canManage = computed(() => canAssignSuppliers(rfq.value))

  return {
    pageState, resourceConfig, ui, user, rfq, procurement, loading, pending, assignedDetails,
    allSupplierRows, availableSuppliers, selectedSupplierCodes, pendingStatusByCode, cancellationReason,
    hasPendingStatusChanges, hasPendingCancellation, hasSelectedNewSuppliers, effectiveProgress,
    setRowTargetStatus, setSelectedSupplierCodes, resetStatusSelection, resetNewSupplierSelection, canManage,
    progressLabel, progressColor, supplierProgressLabel, supplierProgressColor
  }
}
