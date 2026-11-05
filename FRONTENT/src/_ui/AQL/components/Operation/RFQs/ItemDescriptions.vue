<template>
  <div v-if="currentStep === stepPlan.basics" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Item descriptions</div>
        <div class="text-caption text-grey-7">Changes also update the source PR.</div>
        <q-skeleton v-if="itemsLoading" type="text" />
        <div v-else-if="!requisitionItems.length" :class="ui.emptyCaptionClass">Choose a requisition with active items.</div>
        <template v-else>
          <div v-for="item in requisitionItems" :key="item.code" :class="gutterClass">
            <div class="text-weight-medium" :class="ui.flexWrapTextClass">{{ item.primary }}</div>
            <div class="text-caption text-grey-7">{{ item.quantity }} {{ item.uom }}</div>
            <TextareaField :model-value="itemDescription(item.code)" :config="{ label: 'Item description', autogrow: true }"
              @update:model-value="(value) => setItemDescription(item.code, value)" />
          </div>
        </template>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useRFQFormContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQFormContext'

defineOptions({ name: 'RFQsItemDescriptions', inheritAttrs: false })
const TextareaField = resolveFieldComponent('textarea', 'add')
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const { ui, currentStep, stepPlan, requisitionItems, itemDescription, setItemDescription, itemsLoading } = useRFQFormContext()
</script>
