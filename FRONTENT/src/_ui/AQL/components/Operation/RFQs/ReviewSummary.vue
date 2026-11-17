<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="What will be sent" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div v-for="(line, index) in summary" :key="line.label" class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(index)">
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsReviewSummary', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const { ui, locked, currentStep, stepPlan, record } = useRFQAddContext()
const visible = computed(() => !locked.value && currentStep.value === Number(props.step ?? stepPlan.value.review))
const summary = computed(() => [
  ...['PurchaseRequisitionCodes', 'RFQDate', 'QuotationSubmissionDeadline', 'RequiredBy', 'WarehouseCode',
    'Type', 'TypeReferenceCode', 'Priority', 'Username', 'Remarks'].map(key => ({ label: key, value: record.value[key] })),
  { label: 'Progress', value: record.value.Progress }
])
function rowDelay (index) { return { animationDelay: `${index * ui.rowStaggerMs}ms` } }
</script>
