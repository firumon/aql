<template>
  <ResourceActionItem v-bind="$attrs" :handler="openDialog" />
  <AqlDialog v-model="dialogOpen" title="Cancel RFQ" :subtitle="rfq?.Code" icon="cancel" variant="negative"
    confirm-label="Cancel RFQ" confirm-color="negative" :disable-confirm="Boolean(blocker) || !comment.trim()"
    :loading="submitting" @confirm="onConfirm" @cancel="closeDialog">
    <q-banner v-if="blocker" dense rounded class="bg-orange-2 q-mb-sm">{{ blocker }}</q-banner>
    <div v-else class="q-gutter-sm">
      <q-banner v-if="error" dense rounded class="bg-red-1 text-negative q-mb-sm">{{ error }}</q-banner>
      <div v-if="affectedItems.length">{{ affectedItems.length }} requisition items will have quoted quantities reversed.</div>
      <div v-if="procurement">The linked procurement will also be cancelled.</div>
      <q-input v-model="comment" type="textarea" label="Cancellation Reason" outlined :rules="[value => !!value.trim() || 'Enter a reason.']" />
    </div>
  </AqlDialog>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useQuasar } from 'quasar'
import ResourceActionItem from 'components/actions/ResourceActionItem.vue'
import AqlDialog from 'components/shared/AqlDialog.vue'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { usePageState } from 'src/composables/resources/pageState/usePageState'
import { actionFailureMessage } from 'src/composables/resources/additionalActionsPipeline'
import { useRFQResource } from 'src/_resource/Operation/RFQs/composables/useRFQResource'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { useProcurementResource } from 'src/_resource/Operation/Procurements/composables/useProcurementResource'
import { buildRFQCancelChainNodes } from 'src/_resource/Operation/RFQs/composables/useRFQPayload'
import { isActiveRow, rfqCancelBlocker } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'
import { useAuth } from 'src/composables/core/useAuth'

defineOptions({ name: 'RFQsResourceActionCancel', inheritAttrs: false })

const resourceRecord = inject('resourceRecord', null)
const rfqRecords = usePageRecord('RFQs')
const rfqItems = usePageRecord('RFQItems')
const supplierRows = usePageRecord('RFQSuppliers')
const requisitions = usePageRecord('PurchaseRequisitions')
const prItems = usePageRecord('PurchaseRequisitionItems')
const procurements = usePageRecord('Procurements')
const quotations = usePageRecord('SupplierQuotations')
const purchaseOrders = usePageRecord('PurchaseOrders')
const rfqResource = useRFQResource()
const prResource = usePurchaseRequisitionResource()
const procurementResource = useProcurementResource()
const { user } = useAuth()
const $q = useQuasar()
const cancelPageState = usePageState({}, { persist: false })
const dialogOpen = ref(false)
const comment = ref('')
const error = ref('')
const submitting = ref(false)
const rfq = computed(() => resourceRecord?.record?.value || rfqResource.getRFQ(''))
const procurement = computed(() => procurementResource.getProcurement(rfq.value?.ProcurementCode))
const quotationsRows = computed(() => quotations.items.value || [])
const purchaseOrderRows = computed(() => purchaseOrders.items.value || [])
const blocker = computed(() => rfqCancelBlocker(rfq.value, {
  quotations: quotationsRows.value, purchaseOrders: purchaseOrderRows.value
}))
const rfqLines = computed(() => rfqResource.linesOf(rfq.value?.Code))
const requisitionCodes = computed(() => {
  const codes = new Set(String(rfq.value?.PurchaseRequisitionCodes || '').split(',').map(x => x.trim()).filter(Boolean))
  rfqLines.value.forEach(line => Object.keys(line.allocations || {}).forEach(priCode => {
    if (priCode !== 'excess') {
      const code = prResource.getRequisitionItem(priCode)?.PurchaseRequisitionCode
      if (code) codes.add(code)
    }
  }))
  return [...codes]
})
const requisitionRows = computed(() => requisitionCodes.value.map(prResource.getPurchaseRequisition).filter(Boolean))
const requisitionItemRows = computed(() => requisitionRows.value.flatMap(row => prResource.itemsByRequisition.value.get(row.Code) || []))
const rfqItemRows = computed(() => (rfqResource.itemsByRfq.value.get(rfq.value?.Code) || []).filter(isActiveRow))
const supplierRowList = computed(() => rfqResource.suppliersOf(rfq.value?.Code))
const affectedItems = computed(() => rfqLines.value.filter((line) =>
  Object.entries(line.allocations || {}).some(([key, qty]) => key !== 'excess' && Number(qty) > 0)
))

async function openDialog () {
  cancelPageState.reset()
  error.value = ''
  comment.value = ''
  await Promise.all([rfqRecords, rfqItems, supplierRows, requisitions, prItems, procurements, quotations, purchaseOrders]
    .map(resource => resource.reload()))
  dialogOpen.value = true
}

function closeDialog () {
  cancelPageState.reset()
  dialogOpen.value = false
  error.value = ''
}

async function onConfirm () {
  const nodes = buildRFQCancelChainNodes({ rfq: rfq.value, rfqItems: rfqItemRows.value,
    requisitions: requisitionRows.value, prItems: requisitionItemRows.value, supplierRows: supplierRowList.value,
    procurement: procurement.value, quotations: quotationsRows.value, purchaseOrders: purchaseOrderRows.value,
    actorName: user.value?.name || user.value?.email || '', comment: comment.value })
  cancelPageState.reset()
  const applied = cancelPageState.applyNodes(nodes)
  if (applied.valid === false) {
    error.value = applied.message
    return
  }
  submitting.value = true
  try {
    const result = await cancelPageState.run({ notify: false })
    if (result?.success === false) throw new Error(actionFailureMessage(result.response) || 'Could not cancel this RFQ.')
    $q.notify({ type: 'positive', message: applied.successMsg || 'RFQ cancelled.', position: 'top' })
    closeDialog()
  } catch (err) {
    error.value = err.message || 'Could not cancel this RFQ.'
  } finally {
    submitting.value = false
  }
}
</script>
