<template>
  <q-card v-if="editable" flat bordered :class="ui.cardClass">
    <q-card-section :class="gutterClass">
      <FieldDateEdit v-model="requiredDate" header="RequiredDate" :record="form" :config="dateConfig" />
      <FieldRemarksEdit v-if="remarksRequired" v-model="remarks" header="Remarks" :record="form" :config="remarksConfig" />
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useRequisitionFormContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'

defineOptions({ name: 'PurchaseRequisitionsAddRequisitionBasic', inheritAttrs: false })
const FieldDateEdit = resolveFieldComponent('date', 'edit')
const FieldRemarksEdit = resolveFieldComponent('textarea', 'edit')
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const { ui, form, requiredDate, remarks, remarksRequired, editable } = useRequisitionFormContext()
const dateConfig = { label: 'Required By Date', required: true }
const remarksConfig = { label: 'Remarks', required: true }
</script>
