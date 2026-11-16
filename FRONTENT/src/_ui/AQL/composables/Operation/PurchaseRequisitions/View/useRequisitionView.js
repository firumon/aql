import { computed, onMounted } from 'vue'
import { decorateRow } from 'src/utils/appHelpers'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { parseAnyDate } from 'src/utils/dateHelpers'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import {
  progressLabel, progressColor, progressIcon, isOverdue, requisitionWorkflowEvents
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'
import { useRequisitionViewContext } from './useRequisitionViewContext'

const text = (value) => String(value ?? '').trim()
const views = new WeakMap()

export { progressLabel, progressColor, progressIcon }

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
  if (resourceRecord && views.has(resourceRecord)) return views.get(resourceRecord)
  const rfqConfig = useResourceConfig('RFQs')
  const canOpenRfq = computed(() => rfqConfig.allowed('read') === true)
  const rfqs = usePageRecord('RFQs')
  const nav = useResourceNav()
  onMounted(() => {
    if (canOpenRfq.value && !rfqs.items.value.length && !rfqs.loading.value) rfqs.reload()
  })
  const rfqByCode = computed(() => new Map(canOpenRfq.value
    ? rfqs.items.value.map(row => [text(row.Code), row]) : []))
  const { linesByRequisition, itemSummary, loading: resourceLoading } = usePurchaseRequisitionResource()
  const requisition = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true || resourceLoading.value)
  const pending = computed(() => !requisition.value && loading.value)
  const lines = computed(() => (linesByRequisition.value.get(text(requisition.value?.Code)) || []).map(row =>
    decorateRow(row, {
      rfqLinks: row.rfqCodes.map(code => {
        const rfq = rfqByCode.value.get(code)
        return { code, date: rfq?.RFQDate || rfq?.CreatedAt || '', progress: text(rfq?.Progress) }
      })
    })))
  const events = computed(() => requisitionWorkflowEvents(requisition.value, lines.value, rfqByCode.value))
  const openRfq = (code) => {
    const key = text(code)
    if (canOpenRfq.value && key) nav.goTo('view', { scope: 'operation', resourceSlug: 'rfqs', code: key })
  }
  const totals = computed(() => itemSummary(lines.value))
  const overdue = computed(() => isOverdue(requisition.value))
  const view = {
    requisition, loading, pending, lines, totals, overdue, events, canOpenRfq, openRfq,
    progressLabel, progressColor, progressIcon, formatStampDate
  }
  if (resourceRecord) views.set(resourceRecord, view)
  return view
}
