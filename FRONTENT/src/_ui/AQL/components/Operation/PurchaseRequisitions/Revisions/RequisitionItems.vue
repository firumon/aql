<template>
  <div v-if="selectedRecord" class="q-mb-md">
    <SectionDividerLabel label="Requisition Items" />

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
            @btn-click="onRemoveClick"
            @input-change="onQtyChange"
            item-class="bg-transparent" :item-bordered="false" separator
          />
        </q-card-section>
      </template>
    </AqlInlineSkuPicker>
  </div>
</template>

<script setup>
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AppList from 'components/app/AppList.vue'
import AqlInlineSkuPicker from 'components/shared/AqlInlineSkuPicker.vue'
import { useRequisitionRevisionContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Revisions/useRequisitionRevisionContext'

defineOptions({ name: 'PurchaseRequisitionsRevisionsItems', inheritAttrs: false })

const {
  ui,
  selectedRecord,
  items,
  skuQuantities,
  editable,
  skuLabelText,
  updateItemQty,
  removeItem,
  addItems
} = useRequisitionRevisionContext()

function onQtyChange ({ value, item }) {
  updateItemQty(item, value)
}

function onRemoveClick (item) {
  removeItem(item)
}
</script>
