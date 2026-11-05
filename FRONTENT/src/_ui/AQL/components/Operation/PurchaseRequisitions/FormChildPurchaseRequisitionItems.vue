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
    </div>

    <AqlInlineSkuPicker :class="ui.cardClass" :model-value="skuQuantities" type="number" label="Qty" :value="1"
      :disable="!editable" @update:model-value="addItems">
      <template #selected-items>
        <q-card-section>
          <div class="text-subtitle2 text-weight-bold text-grey-8 flex">
            Selected Product{{ existingCodes.length !== 1 ? 's' : '' }} <q-space />{{ existingCodes.length }}
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
        </q-card-section>
      </template>
    </AqlInlineSkuPicker>
  </div>
</template>

<script setup>
import FormChild from 'components/contents/FormChild.vue'
import AqlInlineSkuPicker from 'components/shared/AqlInlineSkuPicker.vue'
import { useRequisitionFormContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'

defineOptions({ name: 'FormChildPurchaseRequisitionItems', inheritAttrs: false })

defineProps({
  childResource: { type: Object, required: true },
  parentResource: { type: String, required: true }
})

const { ui, existingCodes, skuQuantities, editable, skuLabelText, addItems } = useRequisitionFormContext()
const hiddenFields = ['PurchaseRequisitionCode', 'Code', 'Status']
const fieldProps = { SKU: { readonly: true } }
</script>
