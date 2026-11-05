<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="Requisition Products" />

    <AqlInlineSkuPicker :class="ui.cardClass" :model-value="skuQuantities" type="number" label="Qty" :value="1"
      :disable="!editable" @update:model-value="addItems">
      <template #selected-items>
        <q-card-section>
          <div class="text-subtitle2 text-weight-bold text-grey-8 flex">
            Selected Product{{ items.length !== 1 ? 's' : '' }} <q-space />{{ items.length }}
          </div>
          <AppList
            :items="items"
            item-key="SKU"
            :label="(item) => skuLabelText(item.SKU) || item.SKU"
            caption="SKU"
            :input="true"
            input-value="Quantity"
            :input-props="{ type: 'number', min: 1, label: 'Qty', style: 'width: 120px;' }"
            btn="delete" btn-color="negative"
            @btn-click="(item) => removeItem(childIndexes[item.SKU])"
            @input-change="onQtyChange"
            item-class="bg-transparent" :item-bordered="false" separator
          />
        </q-card-section>
      </template>
    </AqlInlineSkuPicker>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AppList from 'components/app/AppList.vue'
import AqlInlineSkuPicker from 'components/shared/AqlInlineSkuPicker.vue'
import { useRequisitionFormContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'

defineOptions({ name: 'PurchaseRequisitionsAddRequisitionItems', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  items,
  skuQuantities,
  totalQuantity,
  updateItem,
  removeItem,
  childIndexes,
  addItems,
  skuLabelText,
  currentStep, editable
} = useRequisitionFormContext()

const visible = computed(() => editable.value && (props.step == null || Number(props.step) === currentStep.value))

function onQtyChange ({ value, item }) {
  const qty = Number(value)
  const val = Number.isFinite(qty) ? qty : 0
  const index = childIndexes.value[item.SKU]
  if (index !== undefined) {
    updateItem(index, { Quantity: val })
  }
}
</script>
