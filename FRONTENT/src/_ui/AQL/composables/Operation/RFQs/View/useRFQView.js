import { computed, onMounted } from 'vue'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useRecord } from 'src/composables/resources/useRecord'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { findResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRFQRequirements } from 'src/_resource/Operation/RFQs/composables/useRFQRequirements'
import { useRFQResource } from 'src/_resource/Operation/RFQs/composables/useRFQResource'
import { useSupplierResource } from 'src/_resource/Master/Suppliers/composables/useSupplierResource'
import { parseAnyDate } from 'src/utils/dateHelpers'
import { progressLabel, progressColor, progressIcon, supplierProgressLabel, supplierProgressColor,
  supplierProgressIcon, workflowStamps, isDeadlinePassed, daysToDeadline, isActiveRow
} from 'src/_resource/Operation/RFQs/composables/useRFQProgress'
import { useRFQViewContext } from './useRFQViewContext'

const views = new WeakMap()

export function formatStampDate (value) {
  return parseAnyDate(value)?.toLocaleString() || String(value || '')
}

export function useRFQView () {
  const { resourceRecord } = useRFQViewContext()
  if (resourceRecord && views.has(resourceRecord)) return views.get(resourceRecord)
  onMounted(() => Promise.all(['RFQItems', 'RFQSuppliers', 'Suppliers',
    'PurchaseRequisitions', 'PurchaseRequisitionItems', 'Procurements', 'SupplierQuotations', 'PurchaseOrders',
    'SKUs', 'Products']
    .filter(name => findResourceConfig(name)?.permissions?.canRead !== false)
    .map(name => usePageRecord(name).reload())))
  const reader = useRFQResource()
  const requirements = useRFQRequirements()
  const suppliers = useSupplierResource()
  const source = useRecord()
  const nav = useResourceNav()
  const rfq = computed(() => resourceRecord?.record?.value || null)
  const projections = source.remember('rfq:viewSuppliers', () => computed(() => {
    const result = new Map()
    for (const [code, entries] of reader.suppliersByRfq.value) {
      const rows = entries.filter(isActiveRow).map(row => ({ code: row.Code, supplierCode: row.SupplierCode,
        name: suppliers.getSupplier(row.SupplierCode)?.Name || row.SupplierCode,
        sentComment: row.ProgressSentComment || '', respondedComment: row.ProgressRespondedComment || '',
        cancelledComment: row.ProgressCancelledComment || '',
        country: suppliers.getSupplier(row.SupplierCode)?.Country || '', sentDate: row.SentDate, progress: row.Progress }))
      const counts = { total: rows.length, assigned: 0, responded: 0, sent: 0, cancelled: 0 }
      for (const row of rows) {
        const key = String(row.progress).toLowerCase()
        if (key in counts) counts[key]++
      }
      counts.active = rows.length - counts.cancelled
      result.set(code, { rows, counts })
    }
    return result
  }))
  const supplierRows = computed(() => projections.value.get(rfq.value?.Code)?.rows || [])
  const supplierCounts = computed(() => projections.value.get(rfq.value?.Code)?.counts || { total: 0 })
  const lines = computed(() => reader.linesOf(rfq.value?.Code))
  const canReadPR = computed(() => Boolean(findResourceConfig('PurchaseRequisitions')?.permissions?.canRead))
  const view = {
    rfq, supplierRows, supplierCounts, lines, canReadPR,
    prCodes: computed(() => String(rfq.value?.PurchaseRequisitionCodes || '').split(',').map(code => code.trim()).filter(Boolean)),
    openPR: code => { if (canReadPR.value) nav.goTo('view', { scope: 'operation', resourceSlug: 'purchase-requisitions', code }) },
    totals: computed(() => reader.itemSummary(reader.itemsByRfq.value.get(rfq.value?.Code) || [])),
    terms: computed(() => requirements.termsOf(rfq.value || {})),
    pending: computed(() => !rfq.value && resourceRecord?.loading?.value),
    deadlinePassed: computed(() => isDeadlinePassed(rfq.value)),
    deadlineDays: computed(() => daysToDeadline(rfq.value)),
    events: computed(() => workflowStamps(rfq.value)),
    progressLabel, progressColor, progressIcon, supplierProgressLabel, supplierProgressColor, supplierProgressIcon, formatStampDate
  }
  if (resourceRecord) views.set(resourceRecord, view)
  return view
}
