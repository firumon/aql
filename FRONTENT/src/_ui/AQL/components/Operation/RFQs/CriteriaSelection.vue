<template>
  <div v-if="!locked && currentStep === stepPlan.criteria" :class="gutterClass">
    <SectionDividerLabel label="Select Requirements" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-caption text-grey-7">Select only the requirements you want to use for this RFQ.</div>
      </q-card-section>
      <q-separator />
      <q-card-section v-if="!criteriaReady">
        <q-banner dense class="bg-amber-1">The RFQ requirements catalogue must be set up in sheet settings before saving.</q-banner>
      </q-card-section>
      <AppList v-else :items="catalogue" label="name" caption="description"
        :layout="['label', 'caption', 'caption']" selectable="left" :input="true" item-key="column" align="top"
        :gutter="attrs.gutter || 'sm'" :item-bordered="false" item-class="bg-transparent" separator :paginate="false">
        <template #content2="{ item }">
          <q-item-label v-if="item.type === 'fixed'" caption class="text-grey-7">
            Options: {{ item.options.join(', ') }}
          </q-item-label>
          <q-item-label v-else caption class="text-grey-7">
            {{ item.order === 'asc' ? 'Higher value is best' : 'Lower value is best' }}
          </q-item-label>
        </template>
        <template #input="{ item }">
          <NumberField :model-value="weightOf(item.column)"
            :config="{ min: 0, max: 10, step: 1, label: 'Weight', style: 'width: 90px' }"
            @update:model-value="value => changeCriterion('set-weight', item.column, value)" />
        </template>
        <template #checkbox="{ item }">
          <q-checkbox :model-value="selectedIds.has(item.column)" :aria-label="`Choose ${item.name}`"
            @update:model-value="changeCriterion('select', item.column)" />
        </template>
      </AppList>
      <q-card-section :class="gutterClass">
        <q-banner v-for="error in criteriaErrors" :key="error.column" dense class="bg-amber-1">{{ error.message }}</q-banner>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQFormContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQFormContext'

defineOptions({ name: 'RFQsCriteriaSelection', inheritAttrs: false })
const NumberField = resolveFieldComponent('number', 'add')
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const { locked, ui, catalogue, criteriaReady, criteriaErrors, selectedCriteria, currentStep, stepPlan,
  weightOf, changeCriterion } = useRFQFormContext()
const selectedIds = computed(() => new Set([
  ...selectedCriteria.value.map((entry) => entry.id),
  ...criteriaErrors.value.map((error) => error.column).filter((column) => catalogue.value.some((entry) => entry.column === column))
]))
</script>
