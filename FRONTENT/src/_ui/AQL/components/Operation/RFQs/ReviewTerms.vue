<template>
  <div v-if="visible && terms.length" :class="gutterClass">
    <q-expansion-item dense icon="tune" label="Commercial terms" :caption="`${terms.length} terms set`">
      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <div :class="ui.detailGridClass">
            <div v-for="line in terms" :key="line.label" class="items-center" :class="ui.detailLineClass">
              <span :class="ui.detailKeyClass">{{ line.label }}</span>
              <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-expansion-item>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsReviewTerms', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const { ui, locked, currentStep, stepPlan, criterionTerms: terms } = useRFQAddContext()
const visible = computed(() => !locked.value && currentStep.value === Number(props.step ?? stepPlan.value.review))
</script>
