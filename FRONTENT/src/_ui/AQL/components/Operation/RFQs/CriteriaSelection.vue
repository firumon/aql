<template>
  <div v-if="currentStep === stepPlan.criteria" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium">Choose criteria</div>
        <div class="text-caption text-grey-7">Select only the criteria you want to use for this RFQ.</div>
      </q-card-section>
      <q-separator />
      <q-card-section v-if="!criteriaReady">
        <q-banner dense class="bg-amber-1">The RFQ criteria catalogue must be set up in sheet settings before saving.</q-banner>
      </q-card-section>
      <AppList v-else :items="catalogue" label="name" caption="description"
        :layout="['label', 'caption', 'caption']" selectable="right" item-key="column" align="top"
        :gutter="attrs.gutter || 'sm'" :item-bordered="false" item-class="bg-transparent" separator>
        <template #content2="{ item }">
          <q-item-label v-if="item.type === 'fixed'" caption class="text-grey-7">
            Options: {{ item.options.join(', ') }}
          </q-item-label>
          <q-item-label v-else caption class="text-grey-7">
            {{ item.order === 'asc' ? 'Higher value is best' : 'Lower value is best' }}
          </q-item-label>
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
import { useRFQFormContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQFormContext'

defineOptions({ name: 'RFQsCriteriaSelection', inheritAttrs: false })
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const { ui, catalogue, criteriaReady, criteriaErrors, selectedCriteria, currentStep, stepPlan,
  changeCriterion } = useRFQFormContext()
const selectedIds = computed(() => new Set([
  ...selectedCriteria.value.map((entry) => entry.id),
  ...criteriaErrors.value.map((error) => error.column).filter((column) => catalogue.value.some((entry) => entry.column === column))
]))
</script>
