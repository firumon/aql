<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">RFQ dates</div>
        <div v-if="editing" class="text-caption text-grey-7">Requisition: {{ record.PurchaseRequisitionCode }}</div>
        <DateField :model-value="record.RFQDate" :record="record" :config="{ label: 'RFQ Date' }" header="RFQDate"
          @update:model-value="(value) => setField('RFQDate', value)" />
        <DateField :model-value="record.QuotationSubmissionDeadline" :record="record"
          :config="{ label: 'Quotation Submission Deadline' }" header="QuotationSubmissionDeadline"
          @update:model-value="(value) => setField('QuotationSubmissionDeadline', value)" />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useRFQFormContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQFormContext'

defineOptions({ name: 'RFQsRFQTerms', inheritAttrs: false })
const props = defineProps({ step: { type: [Number, String], default: null } })
const DateField = resolveFieldComponent('date', 'add')
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const { ui, record, setField, editing, currentStep } = useRFQFormContext()
const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)
</script>
