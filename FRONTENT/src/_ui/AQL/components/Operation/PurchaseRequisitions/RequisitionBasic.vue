<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="Requisition Details" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <FieldSelectEdit
          v-model="prType"
          :record="form"
          :config="typeConfig"
          header="Type"
        />

        <FieldSelectEdit
          v-model="prPriority"
          :record="form"
          :config="priorityConfig"
          header="Priority"
        />

        <FieldDateEdit
          v-model="requiredDate"
          :record="form"
          :config="dateConfig"
          header="RequiredDate"
        />

        <FieldSelectEdit
          v-model="warehouseCode"
          :record="form"
          :config="warehouseConfig"
          header="WarehouseCode"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
const FieldSelectEdit = resolveFieldComponent('select', 'edit')
const FieldDateEdit = resolveFieldComponent('date', 'edit')
import {
  useRequisitionFormContext,
  TYPE_OPTIONS,
  PRIORITY_OPTIONS
} from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'

defineOptions({ name: 'PurchaseRequisitionsAddRequisitionBasic', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  form,
  prType, prPriority, requiredDate, warehouseCode,
  warehouseOptions,
  currentStep, editable
} = useRequisitionFormContext()

const visible = computed(() => editable.value && (props.step == null || Number(props.step) === currentStep.value))

const typeConfig = { label: 'Requisition Type', options: TYPE_OPTIONS, required: true }
const priorityConfig = { label: 'Priority', options: PRIORITY_OPTIONS, required: true }
const dateConfig = { label: 'Required By Date', required: true }
const warehouseConfig = computed(() => ({
  label: 'Destination Warehouse',
  options: warehouseOptions.value,
  required: true
}))
</script>
