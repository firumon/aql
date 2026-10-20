<template>
  <div v-if="selectedRecord" class="q-mb-md">
    <SectionDividerLabel label="Requisition Items" />

    <q-card v-if="!items.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No products selected</div>
        <div :class="ui.emptyCaptionClass" class="q-mb-md">Add at least one product with quantity 1 or more.</div>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="playlist_add"
          label="Pick Products"
          class="aql-dialog-btn shadow-1"
          @click="showSkuPicker = true"
        />
      </q-card-section>
    </q-card>

    <q-card v-else flat bordered :class="ui.cardClass">
      <q-card-section class="row items-center justify-between q-py-sm">
        <div class="text-subtitle2 text-weight-medium text-grey-8">
          Product{{ items.length !== 1 ? 's' : '' }}: {{ items.length }}
        </div>

        <q-btn
          no-caps
          unelevated
          color="primary"
          icon="playlist_add"
          label="Pick Products"
          class="aql-dialog-btn"
          @click="showSkuPicker = true"
        />
      </q-card-section>

      <q-separator />

      <q-card-section class="q-pa-none">
        <AppList
          :items="items"
          item-key="SKU"
          :label="(item) => skuLabelText(item.SKU) || item.SKU"
          :caption="(item) => ['SKU: ' + item.SKU, item.UOM || 'PCS'].filter(Boolean).join(' · ')"
          :input="true"
          :input-props="quantityProps"
          input-value="Quantity"
          btn="delete"
          btn-color="negative"
          @btn-click="onRemoveClick"
          @input-change="onQtyChange"
          item-class="bg-transparent"
          :item-bordered="false"
          separator
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
      v-model="showSkuPicker"
      :preselected-codes="existingCodes"
      @confirm="onSkusConfirmed"
    />
  </div>
</template>

<script setup>
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AppList from 'components/app/AppList.vue'
import AqlSkuPicker from 'components/shared/AqlSkuPicker.vue'
import { useRequisitionRevisionContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Revisions/useRequisitionRevisionContext'

defineOptions({ name: 'PurchaseRequisitionsRevisionsItems', inheritAttrs: false })

const {
  ui,
  selectedRecord,
  items,
  existingCodes,
  totalQuantity,
  showSkuPicker,
  skuLabelText,
  updateItemQty,
  removeItem,
  addItems
} = useRequisitionRevisionContext()

const quantityProps = { type: 'number', min: 1, label: 'Qty', style: 'width: 90px;' }

function onQtyChange ({ value, item }) {
  updateItemQty(item, value)
}

function onRemoveClick (item) {
  removeItem(item)
}

function onSkusConfirmed (selectedSkus) {
  addItems(selectedSkus)
}
</script>
