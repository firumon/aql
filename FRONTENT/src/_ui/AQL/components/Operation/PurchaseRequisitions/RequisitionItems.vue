<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="Requisition Products" />

    <q-card v-if="!items.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No products selected</div>
        <div :class="ui.emptyCaptionClass" class="q-mb-md">Pick the items you want to requisition.</div>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="playlist_add"
          label="Pick Products"
          class="aql-dialog-btn shadow-1"
          @click="showPicker = true"
        />
      </q-card-section>
    </q-card>

    <q-card v-else flat :class="ui.cardClass">
      <q-card-section class="row items-center justify-between q-py-sm">
        <div class="text-subtitle2 text-weight-medium text-grey-8">
          Product{{ items.length !== 1 ? 's' : '' }}: {{ items.length }}
        </div>

        <q-btn
          no-caps
          color="primary"
          icon="playlist_add"
          label="Pick Products"
          class="aql-dialog-btn"
          @click="showPicker = true"
        />
      </q-card-section>

      <q-separator />

      <q-card-section>
        <AppList
          :items="items"
          item-key="SKU"
          :label="(item) => skuLabelText(item.SKU) || item.SKU"
          :caption="itemCaption"
          :input="true"
          input-value="Quantity"
          :input-props="{ type: 'number', min: 1, label: 'Qty', style: 'width: 120px;' }"
          btn="delete" btn-color="negative"
          @btn-click="(item) => removeItem(childIndexes[item.SKU])"
          @input-change="onQtyChange"
          item-class="bg-transparent" :item-bordered="false" separator
        />
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="row items-center justify-between text-weight-bold">
          <span>{{ items.length }} line{{ items.length !== 1 ? 's' : '' }}</span>
          <span class="text-primary">{{ totalQuantity }} unit{{ totalQuantity !== 1 ? 's' : '' }}</span>
        </div>
      </q-card-section>
    </q-card>

    <AqlSkuPicker
      v-model="showPicker"
      :preselected-codes="existingCodes"
      @confirm="onSkusConfirmed"
    />
  </div>
</template>

<script setup>
import { ref, computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AppList from 'components/app/AppList.vue'
import AqlSkuPicker from 'components/shared/AqlSkuPicker.vue'
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
  existingCodes,
  totalQuantity,
  updateItem,
  removeItem,
  childIndexes,
  addItems,
  skuLabelText,
  currentStep, editable
} = useRequisitionFormContext()

const visible = computed(() => editable.value && (props.step == null || Number(props.step) === currentStep.value))
const showPicker = ref(false)

const itemCaption = (item) =>
  ['SKU: ' + item.SKU, item.UOM || 'PCS']
    .filter(Boolean)
    .join(' · ')

function onQtyChange ({ value, item }) {
  const qty = Number(value)
  const val = Number.isFinite(qty) ? qty : 0
  const index = childIndexes.value[item.SKU]
  if (index !== undefined) {
    updateItem(index, { Quantity: val })
  }
}

function onSkusConfirmed (selectedSkus, selectedCodes) {
  addItems(selectedSkus, selectedCodes)
}
</script>
