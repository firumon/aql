<template>
  <div v-if="!locked && activeCriterion && currentStep >= (stepPlan.criterionStart || 3)
    && currentStep < (stepPlan.suppliers || stepPlan.review)" :class="gutterClass">
    <SectionDividerLabel label="Requirement Options" />
    <q-card flat bordered :class="ui.cardClass">
      <AppList :items="[activeCriterion]" label="name" caption="description" :layout="['label', 'caption']"
        item-key="id" align="top" :gutter="attrs.gutter || 'sm'" :item-bordered="false" item-class="bg-transparent">
        <template #input>
          <NumberField :model-value="activeCriterion.weight"
            :config="{ label: 'Weight (1–10)', min: 1, max: 10, step: 1, style: 'width: 105px' }"
            @update:model-value="(value) => changeCriterion('weight', activeCriterion.id, value)" />
        </template>
      </AppList>
      <q-separator />
      <q-card-section v-if="activeCriterion.type === 'scaled'" :class="gutterClass">
        <q-item class="q-px-none">
          <q-item-section>
            <q-item-label class="text-subtitle2">Best value</q-item-label>
          </q-item-section>
          <q-item-section side>
            <PlainSelectField :model-value="activeCriterion.order"
              :config="{ options: orderOptions, style: 'width: 170px' }"
              @update:model-value="(value) => changeCriterion('order', activeCriterion.id, value)" />
          </q-item-section>
        </q-item>
      </q-card-section>
      <template v-else>
        <q-card-section>
          <div class="text-subtitle2">Options and points</div>
          <div class="text-caption text-grey-7">Give each option a score from 0 to 10.</div>
        </q-card-section>
        <AppList :items="activeCriterion.options" label="name" caption="description" :layout="['label', 'caption']"
          item-key="id" input="points" :input-props="{ type: 'number', label: 'Points (0–10)', min: 0, max: 10, step: 0.01,
            style: 'width: 105px' }" :btn="(item) => item.custom ? 'delete_outline' : false" btn-color="negative"
          align="top" :gutter="attrs.gutter || 'sm'" :item-bordered="false" item-class="bg-transparent" separator
          @input-change="changeCriterion('option-points', activeCriterion.id, $event.value, $event.item.id)"
          @btn-click="changeCriterion('remove-option', activeCriterion.id, null, $event.id)" />
        <q-separator />
        <q-card-section :class="gutterClass">
          <div class="row" :class="`q-col-gutter-${attrs.gutter || 'sm'}`">
            <div class="col-8">
              <TextField v-model="draft.name" :config="{ label: 'Option name' }" />
            </div>
            <div class="col-3" :class="`q-pr-${attrs.gutter || 'sm'}`">
              <NumberField v-model="draft.points"
                :config="{ label: 'Points (0–10)', min: 0, max: 10, step: 0.01, style: 'width: 100%' }" />
            </div>
            <div class="col-1 flex flex-center" :class="`q-pl-${attrs.gutter || 'sm'}`">
              <q-btn icon="send" color="primary" unelevated round aria-label="Add option"
                @click="changeCriterion('add-option', activeCriterion.id, draft).success && Object.assign(draft,
                  { name: '', description: '', points: 0 })" />
            </div>
            <div class="col-12">
              <TextareaField v-model="draft.description" :config="{ label: 'Description (optional)', rows: 4 }" />
            </div>
          </div>
        </q-card-section>
      </template>
    </q-card>
  </div>
</template>

<script setup>
import { computed, reactive, useAttrs } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQFormContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQFormContext'

defineOptions({ name: 'RFQsCriterionOptions', inheritAttrs: false })
const NumberField = resolveFieldComponent('number', 'add')
const TextField = resolveFieldComponent('text', 'add')
const TextareaField = resolveFieldComponent('textarea', 'add')
const PlainSelectField = resolveFieldComponent('plainselect', 'add')
const orderOptions = [
  { label: 'Lower is best', value: 'desc' },
  { label: 'Higher is best', value: 'asc' }
]
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const draft = reactive({ name: '', description: '', points: 0 })
const { locked, ui, activeCriterion, currentStep, stepPlan, changeCriterion } = useRFQFormContext()
</script>
