import { computed, inject, onMounted } from 'vue'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useRFQSupplierResource } from 'src/_resource/Operation/RFQSuppliers/composables/useRFQSupplierResource'
import { useRFQRequirements } from 'src/_resource/Operation/RFQs/composables/useRFQRequirements'
import { supplierProgressLabel, supplierProgressColor } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'

export function useRFQSupplierView () {
  const resourceRecord = inject('resourceRecord', null)
  const ui = useAQLConfig()
  const rfqs = usePageRecord('RFQs')
  const suppliers = usePageRecord('Suppliers')
  const quotations = usePageRecord('SupplierQuotations')
  const resource = useRFQSupplierResource()
  const criteria = useRFQRequirements()
  onMounted(() => { [rfqs, suppliers, quotations].forEach((item) => item.reload()) })
  const row = computed(() => resourceRecord?.record?.value || null)
  const rfq = computed(() => resource.rfqOf(row.value))
  const supplier = computed(() => resource.supplierOf(row.value))
  const quotation = computed(() => quotations.records.value.find((item) =>
    String(item.RFQCode ?? '').trim() === String(row.value?.RFQCode ?? '').trim() &&
    String(item.SupplierCode ?? '').trim() === String(row.value?.SupplierCode ?? '').trim() &&
    String(item.Status || 'Active').toLowerCase() === 'active') || null)
  const terms = computed(() => rfq.value ? criteria.termsOf(rfq.value) : [])
  const pending = computed(() => !row.value && resourceRecord?.loading?.value === true)
  const timeline = computed(() => resource.timelineOf(row.value || {}, quotation.value))
  const formatDate = (value, withTime = false) => value ? value.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }) : 'Not recorded'
  return { ui, row, rfq, supplier, terms, pending, timeline, formatDate, supplierProgressLabel, supplierProgressColor }
}
