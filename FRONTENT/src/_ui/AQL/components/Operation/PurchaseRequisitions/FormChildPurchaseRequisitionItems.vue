<template>
  <div class="q-mb-md">
    <div class="row items-center justify-between q-mt-md q-mb-sm">
      <div class="row items-center q-gutter-x-sm">
        <q-icon name="list_alt" size="20px" color="primary" />
        <span class="text-subtitle2 text-weight-bold text-grey-9">Requisition Items</span>
        <q-badge v-if="existingCodes.length" color="primary" rounded>
          {{ existingCodes.length }}
        </q-badge>
      </div>

      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="playlist_add"
        label="Pick Products"
        class="aql-dialog-btn shadow-1"
        @click="showPicker = true"
      />
    </div>

    <FormChild
      v-bind="$attrs"
      :child-resource="childResource"
      :parent-resource="parentResource"
      title=" "
      list-position="top"
    />

    <AqlSkuPicker
      v-model="showPicker"
      :preselected-codes="existingCodes"
      @confirm="onSkusConfirmed"
    />
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import FormChild from 'components/contents/FormChild.vue'
import AqlSkuPicker from 'components/shared/AqlSkuPicker.vue'

defineOptions({ name: 'FormChildPurchaseRequisitionItems', inheritAttrs: false })

const props = defineProps({
  childResource: { type: Object, required: true },
  parentResource: { type: String, required: true }
})

const pageState = inject('pageState', null)
const showPicker = ref(false)

const parentNode = pageState?.useNode(() => props.parentResource || 'PurchaseRequisitions')
const childRecords = parentNode?.children(() => 'PurchaseRequisitionItems')

const existingCodes = computed(() => {
  const list = childRecords?.value || []
  return list
    .filter((r) => r._action !== 'deactivate')
    .map((r) => r.SKU)
    .filter(Boolean)
})

function onSkusConfirmed(selectedSkus) {
  if (!pageState || !Array.isArray(selectedSkus)) return
  const currentSet = new Set(existingCodes.value)

  for (const sku of selectedSkus) {
    if (!sku?.Code || currentSet.has(sku.Code)) continue
    pageState.addChild(
      'PurchaseRequisitionItems',
      {
        SKU: sku.Code,
        UOM: sku.UOM || 'PCS',
        Quantity: 1,
        EstimatedRate: 0
      },
      props.parentResource || 'PurchaseRequisitions'
    )
    currentSet.add(sku.Code)
  }
}
</script>
