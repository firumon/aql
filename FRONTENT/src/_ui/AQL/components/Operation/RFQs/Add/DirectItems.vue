<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="Select Items" />

    <AqlInlineSkuPicker
      :class="ui.cardClass"
      :model-value="Object.fromEntries(directItems.map((item) => [item.sku, item.quantity]))"
      label="Quantity"
      type="number"
      :value="1"
      @update:model-value="addDirectSkus"
    >
      <template #selected-items>
        <q-card-section :class="gutterClass">
          <div>
            <div class="text-subtitle1 text-weight-medium">Selected Items</div>
            <div class="text-caption text-grey-7">Add description for items (optional).</div>
          </div>
          <div v-if="!directItems.length" class="text-center q-py-lg">
            <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
            <div :class="ui.emptyTitleClass">No items added</div>
          </div>

          <q-list v-else separator>
            <q-item v-for="(item, index) in directItems" :key="item.code || item.sku" class="q-px-none q-py-md">
              <q-item-section>
                <div class="row items-start justify-between no-wrap q-col-gutter-sm q-mb-sm">
                  <div class="col">
                    <div class="text-weight-medium" :class="ui.flexWrapTextClass">
                      {{ item.secondary ? `${item.primary} / ${item.secondary}` : item.primary }}
                    </div>
                    <div class="text-caption text-grey-7">Qty: {{ item.quantity }} {{ item.uom }}</div>
                  </div>
                  <q-btn
                    flat
                    round
                    dense
                    color="negative"
                    icon="delete_outline"
                    :aria-label="`Remove ${item.primary}`"
                    @click="removeDirectItem(index)"
                  >
                    <q-tooltip>Remove item</q-tooltip>
                  </q-btn>
                </div>
                <TextareaField
                  :model-value="item.description || ''"
                  :config="{ label: 'Item description', rows:2 }"
                  @update:model-value="(value) => updateDirectItem(index, { description: value })"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </template>
    </AqlInlineSkuPicker>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlInlineSkuPicker from 'components/shared/AqlInlineSkuPicker.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsAddDirectItems', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const TextareaField = resolveFieldComponent('textarea', 'add')

const {
  ui,
  sourceType,
  directItems,
  addDirectSkus,
  updateDirectItem,
  removeDirectItem,
  currentStep
} = useRFQAddContext()

const visible = computed(() => {
  if (sourceType.value !== 'DIRECT') return false
  return props.step == null || Number(props.step) === currentStep.value
})
</script>
