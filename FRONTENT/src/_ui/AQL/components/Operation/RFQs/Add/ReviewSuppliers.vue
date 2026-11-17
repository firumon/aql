<template>
  <div v-if="visible && !editing" :class="gutterClass">
    <SectionDividerLabel label="Suppliers" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div v-if="!selectedSupplierCodes.length" :class="ui.emptyTitleClass">No supplier selected</div>
        <template v-else>
          <div class="text-caption text-grey-7 q-mb-sm">Total suppliers: {{ selectedSupplierCodes.length }}</div>
          <AppList dense separator :items="selectedSuppliers" item-key="Code" label="Name"
            :label-class="ui.flexWrapTextClass" :paginate="false" :gutter="false" :item-bordered="false"
            item-class="bg-transparent" />
        </template>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsAddReviewSuppliers', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const { ui, locked, currentStep, stepPlan, editing, selectedSupplierCodes, selectedSuppliers } = useRFQAddContext()
const visible = computed(() => !locked.value && currentStep.value === Number(props.step ?? stepPlan.value.review))
</script>
