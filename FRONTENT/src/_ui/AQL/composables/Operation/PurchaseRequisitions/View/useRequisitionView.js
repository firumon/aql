import { computed } from 'vue'
import { parseAnyDate } from 'src/utils/dateHelpers'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { useProcurementResource } from 'src/_resource/Operation/Procurements/composables/useProcurementResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import {
  progressLabel,
  progressColor,
  progressIcon,
  typeMeta,
  priorityMeta,
  needsTypeReference,
  isRevisionRequired,
  isRejected,
  stampOf,
  workflowStamps
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'
import {
  progressLabel as procurementLabel, progressColor as procurementColor, progressIcon as procurementIcon
} from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import { useRequisitionViewContext } from './useRequisitionViewContext'

const text = (value) => String(value ?? '').trim()

export { progressLabel, progressColor, progressIcon, typeMeta, priorityMeta, workflowStamps }

export function formatStampDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = parseAnyDate(raw)
  if (!parsed) return raw
  return parsed.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function useRequisitionView () {
  const { resourceRecord } = useRequisitionViewContext()

  const { linesByRequisition, itemSummary } = usePurchaseRequisitionResource()
  const { getProcurement } = useProcurementResource()

  const { getWarehouse } = useWarehouseResource()

  const requisition = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true)
  const pending = computed(() => !requisition.value && loading.value)

  const warehouseName = computed(() => {
    const code = text(requisition.value?.WarehouseCode)
    if (!code) return ''
    return text(getWarehouse(code)?.name) || code
  })

  const lines = computed(() => linesByRequisition.value.get(text(requisition.value?.Code)) || [])
  const totals = computed(() => itemSummary(lines.value))

  const procurement = computed(() => {
    const code = text(requisition.value?.ProcurementCode)
    if (!code) return null
    return getProcurement(code)
  })

  const procurementStage = computed(() => {
    const row = procurement.value
    if (!row) return null
    return Object.assign(Object.create(row), {
      ...row, _raw: row,
      code: text(row.Code),
      label: procurementLabel(row.Progress),
      color: procurementColor(row.Progress),
      icon: procurementIcon(row.Progress),
      initiatedDate: text(row.InitiatedDate)
    })
  })

  const revisionNote = computed(() => stampOf(requisition.value, 'ProgressRevisionRequired').comment)
  const rejectionNote = computed(() => stampOf(requisition.value, 'ProgressRejected').comment)
  const needsRevision = computed(() => isRevisionRequired(requisition.value))
  const rejected = computed(() => isRejected(requisition.value))
  const referenceRequired = computed(() => needsTypeReference(requisition.value?.Type))
  const events = computed(() => workflowStamps(requisition.value))

  return {
    requisition,
    loading,
    pending,
    warehouseName,
    lines,
    totals,
    procurement,
    procurementStage,
    revisionNote,
    rejectionNote,
    needsRevision,
    rejected,
    referenceRequired,
    events,
    progressLabel,
    progressColor,
    progressIcon,
    typeMeta,
    priorityMeta,
    formatStampDate
  }
}
