<template>
  <div v-if="canManage" :class="gutterClass">
    <SectionDividerLabel label="Add New Suppliers" />
    <q-card flat bordered :class="ui.cardClass">
      <q-banner v-if="hasPendingStatusChanges" dense class="bg-grey-2 text-grey-8">
        Apply or revert pending supplier status changes before adding new suppliers.
      </q-banner>
      <q-card-section v-if="!availableSuppliers.length" class="text-center q-py-lg">
        <q-icon name="group_off" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No new suppliers available</div>
        <div :class="ui.emptyCaptionClass">Every active supplier already has an entry on this RFQ.</div>
      </q-card-section>
      <AqlInlineMasterPicker v-else flat dense :filter-dense="false" :items="availableSuppliers"
        item-key="code" search-by="name" filter-label="Filter by supplier name"
        :model-value="selectedSupplierMap" :disable="submitting || hasPendingStatusChanges"
        :class="{ disabled: hasPendingStatusChanges }"
        :list-props="{ label: 'name', caption: pickerCaption, labelClass: ui.flexWrapTextClass, itemClass: 'bg-transparent' }"
        @update:model-value="setSelectedSupplierCodes(Object.keys($event))" />
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import AqlInlineMasterPicker from 'components/shared/AqlInlineMasterPicker.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQSupplierFlowContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQSupplierFlowContext'

defineOptions({ name: 'RFQsManageSuppliersAddSuppliers', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const {
  ui, pageState, canManage, availableSuppliers, selectedSupplierCodes, hasPendingStatusChanges, setSelectedSupplierCodes
} = useRFQSupplierFlowContext()
const submitting = computed(() => pageState?.meta?.submitting === true)
const selectedSupplierMap = computed(() => Object.fromEntries(selectedSupplierCodes.value.map(code => [code, true])))

function pickerCaption (row) { return [row.country, row.contact].filter(Boolean).join(' • ') }
</script>
