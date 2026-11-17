<template>
  <div v-if="currentStep === Number(step) || locked" :class="gutterClass">
    <q-banner v-if="locked" class="bg-amber-1">This RFQ is locked. Only Draft and Assigned RFQs can be edited.</q-banner>
    <template v-else>
      <SectionDividerLabel label="Items to Quote" />
      <AqlInlineSkuPicker :class="ui.cardClass" :model-value="skuQuantities" type="number" label="Qty" :value="1"
        :disable="locked" @update:model-value="addDirectSkus">
        <template #selected-items>
          <q-card-section>
            <div class="text-subtitle2 text-weight-bold text-grey-8 flex">
              Items to Quote <q-space />{{ selectedItems.length }}
            </div>
            <q-list separator>
              <q-item dense class="q-px-none q-py-sm" v-for="item in selectedItems" :key="item.SKU">
                <q-item-section>
                  <div class="row items-center no-wrap full-width">
                    <div class="col q-pr-sm" style="min-width: 0">
                      <q-item-label>{{ [item.SKU, item.primary].filter(Boolean).join(' · ') }}</q-item-label>
                      <q-item-label caption>UOM: {{ item.UOM }}</q-item-label>
                    </div>
                    <div class="col-auto row items-center no-wrap q-gutter-x-xs">
                      <NumberField :model-value="item.Quantity"
                        :config="{ label: 'Qty', min: 1, style: 'width: 76px' }" :disable="locked"
                        @update:model-value="value => updateDirectItem(childIndexes[item.SKU], { Quantity: value })" />
                      <q-btn flat round class="q-px-none q-mx-none" icon="delete_outline" color="negative" aria-label="Remove item" :disable="locked"
                        @click="removeDirectItem(item.SKU)" />
                    </div>
                  </div>
                  <div class="q-mt-xs full-width">
                    <TextField :model-value="item.Description" :config="{ label: 'Description', rows: 2 }" :disable="locked"
                      @update:model-value="value => updateDirectItem(childIndexes[item.SKU], { Description: value })" />
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </template>
      </AqlInlineSkuPicker>
    </template>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlInlineSkuPicker from 'components/shared/AqlInlineSkuPicker.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ inheritAttrs: false })
defineProps({ step: { type: [Number, String], default: 1 } })
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const {
  ui, selectedItems, skuQuantities, childIndexes, currentStep, addDirectSkus, updateDirectItem, removeDirectItem, locked
} = useRFQAddContext()
const NumberField = resolveFieldComponent('number', 'add')
const TextField = resolveFieldComponent('textarea', 'add')
</script>
