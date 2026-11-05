<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="Suppliers to invite" />

    <div v-if="!availableSuppliers.length" class="text-center q-py-lg">
      <q-icon name="group_off" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
      <div :class="ui.emptyTitleClass">No active suppliers</div>
      <div :class="ui.emptyCaptionClass">Add a supplier before sending an RFQ out.</div>
    </div>

    <AqlInlineMasterPicker v-else dense :filter-dense="false" :class="ui.cardClass" :items="availableSuppliers"
      :model-value="Object.fromEntries(selectedSupplierCodes.map(code => [code, '']))"
      filter-label="Filter by supplier name" search-by="name"
      :list-props="{ label: 'name', caption: captionOf, labelClass: ui.flexWrapTextClass, itemClass: 'bg-transparent' }"
      @update:model-value="toggleSupplier(Object.keys($event))">
      <template #selected-items>
        <q-card-section v-if="selectedSuppliers.length">
          <AppList dense :items="selectedSuppliers" item-key="Code" separator
            :label="item => `${selectedSuppliers.indexOf(item) + 1}. ${item.Name}`"
            :label-class="ui.flexWrapTextClass" :paginate="false" :gutter="false" :item-bordered="false"
            item-class="bg-transparent" btn="delete_outline" btn-color="negative" @btn-click="toggleSupplier" />
        </q-card-section>
      </template>
    </AqlInlineMasterPicker>
  </div>
</template>
<script setup>
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlInlineMasterPicker from 'components/shared/AqlInlineMasterPicker.vue'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsAddSupplierSelection', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, availableSuppliers, selectedSupplierCodes, selectedSuppliers, toggleSupplier, currentStep, stepPlan } = useRFQAddContext()

const visible = computed(() => Number(props.step ?? stepPlan.value.suppliers) === currentStep.value)
function captionOf (supplier) {
  return [supplier.country || supplier.Country, supplier.contact || supplier.ContactPerson].filter(Boolean).join(' • ')
}
</script>
