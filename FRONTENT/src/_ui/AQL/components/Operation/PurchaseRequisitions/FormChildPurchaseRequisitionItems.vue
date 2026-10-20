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
      :hide-fields="hiddenFields"
      :field-props="fieldProps"
      :item-label="(r) => skuLabelText(r?.SKU) || r?.SKU || 'Item'"
      :item-caption="(r) => `Qty: ${r?.Quantity ?? 1} ${r?.UOM || ''}`"
    />

    <AqlSkuPicker
      v-model="showPicker"
      :preselected-codes="existingCodes"
      @confirm="addItems"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import FormChild from 'components/contents/FormChild.vue'
import AqlSkuPicker from 'components/shared/AqlSkuPicker.vue'
import { useRequisitionFormContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'

defineOptions({ name: 'FormChildPurchaseRequisitionItems', inheritAttrs: false })

defineProps({
  childResource: { type: Object, required: true },
  parentResource: { type: String, required: true }
})

const { existingCodes, skuLabelText, addItems } = useRequisitionFormContext()
const showPicker = ref(false)
const hiddenFields = ['PurchaseRequisitionCode', 'Code', 'Status']
const fieldProps = { SKU: { readonly: true } }
</script>
