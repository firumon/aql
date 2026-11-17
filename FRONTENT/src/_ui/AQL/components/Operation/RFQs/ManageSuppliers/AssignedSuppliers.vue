<template>
  <div :class="gutterClass">
    <q-banner v-if="!canManage && rfq" dense rounded class="bg-orange-2">
      <template #avatar><q-icon name="lock" color="orange-9" /></template>
      This RFQ is closed or cancelled, so suppliers can no longer be changed.
    </q-banner>

    <SectionDividerLabel label="Assigned Suppliers" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <q-banner v-if="canManage && hasSelectedNewSuppliers" dense class="bg-grey-2 text-grey-8 q-mb-sm">
          Assign or clear new supplier selections before changing supplier statuses.
        </q-banner>
        <div v-if="!allSupplierRows.length" class="text-center q-py-lg">
          <q-icon name="group_add" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">No suppliers yet</div>
          <div :class="ui.emptyCaptionClass">Choose new suppliers below to add them to this RFQ.</div>
        </div>
        <q-list separator>
          <q-item v-for="row in allSupplierRows" :key="row.code" dense class="q-px-none q-py-sm">
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ row.name }}</q-item-label>
              <q-item-label caption>{{ supplierCaption(row) }}</q-item-label>
              <q-item-label v-if="row.sentComment" caption>Send: {{ row.sentComment }}</q-item-label>
              <q-item-label v-if="row.respondedComment" caption>Reply: {{ row.respondedComment }}</q-item-label>
              <q-item-label v-if="row.cancelledComment" caption>Cancelled: {{ row.cancelledComment }}</q-item-label>
              <q-item-label v-if="row.locked" caption>Locked — quotation recorded</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge v-if="!canManage || row.locked" rounded :color="supplierProgressColor(row.progress)"
                :label="supplierProgressLabel(row.progress)" />
              <q-btn-toggle v-else no-caps size="sm" padding="sm md" color="grey-3" glossy push
                text-color="grey-8" toggle-text-color="white" :options="statusOptions"
                :toggle-color="supplierProgressColor(effectiveProgress(row))"
                :model-value="effectiveProgress(row)" :disable="submitting || hasSelectedNewSuppliers"
                @update:model-value="val => setRowTargetStatus(row, val)" />
            </q-item-section>
          </q-item>
        </q-list>
        <q-input v-if="canManage && hasPendingCancellation" v-model="cancellationReason" type="textarea"
          outlined dense autogrow label="Cancellation Reason" class="q-mt-sm" :disable="submitting"
          :rules="[val => !!String(val || '').trim() || 'Enter a cancellation reason.']" />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQSupplierFlowContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQSupplierFlowContext'

defineOptions({ name: 'RFQsManageSuppliersAssignedSuppliers', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const {
  ui, rfq, pageState, canManage, allSupplierRows, cancellationReason, hasSelectedNewSuppliers,
  hasPendingCancellation, effectiveProgress, setRowTargetStatus, supplierProgressColor, supplierProgressLabel
} = useRFQSupplierFlowContext()
const submitting = computed(() => pageState?.meta?.submitting === true)
const statusOptions = [
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Cancelled', value: 'CANCELLED' }
]

function supplierCaption (row) {
  return [row.country, row.contact, row.sentDate ? `Sent: ${row.sentDate}` : ''].filter(Boolean).join(' • ')
}
</script>
