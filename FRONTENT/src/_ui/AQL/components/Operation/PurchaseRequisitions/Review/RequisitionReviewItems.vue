<template>
  <q-card flat bordered :class="ui.cardClass">
    <q-card-section class="row items-center justify-between">
      <div class="text-subtitle1 text-weight-bold">Requisition Items</div>
      <q-badge color="grey-7" :label="`${items.length} item(s)`" />
    </q-card-section>
    <q-card-section v-if="!items.length" class="text-center text-grey-7">
      No items found. The request must contain products before it can be approved.
    </q-card-section>
    <AppList v-else :items="items" item-key="Code" :label="(item) => skuLabelText(item.SKU) || item.SKU"
      :caption="(item) => `${item.Quantity} ${item.UOM || ''}`" />
  </q-card>
</template>

<script setup>
import AppList from 'components/app/AppList.vue'
import { useRequisitionReviewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Review/useRequisitionReviewContext'

defineOptions({ name: 'PurchaseRequisitionsReviewItems', inheritAttrs: false })
const { ui, items, skuLabelText } = useRequisitionReviewContext()
</script>
