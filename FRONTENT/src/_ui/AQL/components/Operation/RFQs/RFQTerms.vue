<template>
  <div v-if="!locked && currentStep === Number(step)" :class="gutterClass">
    <SectionDividerLabel label="Basic Details" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <component :is="resolveFieldComponent(field.fieldType, 'add')" v-for="field in fields" :key="field.name"
          :model-value="record[field.name]" :record="record" :header="field.name" :config="field"
          @update:model-value="value => setField(field.name, value)" />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useRFQFormContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQFormContext'

defineOptions({ inheritAttrs: false })
defineProps({ step: { type: [Number, String], default: 2 } })
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const { locked, ui, record, currentStep, setField, fields } = useRFQFormContext()
</script>
