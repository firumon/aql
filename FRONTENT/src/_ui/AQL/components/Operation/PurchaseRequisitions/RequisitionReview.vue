<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="Requisition Details" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div class="items-center" :class="ui.detailLineClass">
            <span :class="ui.detailKeyClass">Type</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ typeMeta(form.Type).label || form.Type }}
            </span>
          </div>

          <div class="items-center" :class="ui.detailLineClass">
            <span :class="ui.detailKeyClass">Priority</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ priorityMeta(form.Priority).label || form.Priority }}
            </span>
          </div>

          <div class="items-center" :class="ui.detailLineClass">
            <span :class="ui.detailKeyClass">Required By</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ form.RequiredDate }}
            </span>
          </div>

          <div class="items-center" :class="ui.detailLineClass">
            <span :class="ui.detailKeyClass">Destination Warehouse</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ warehouseName || '—' }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <SectionDividerLabel label="Requisition Items" />

    <q-card flat :class="ui.cardClass">
      <AppList
        v-if="items.length"
        :items="items"
        item-key="SKU"
        :label="(item) => skuLabelText(item.SKU) || item.SKU"
        :caption="(item) => ['SKU: ' + item.SKU, item.Quantity + ' ' + (item.UOM || 'PCS')].filter(Boolean).join(' · ')"
        :meta-label="(item) => Number(item.Quantity)"
        :item-bordered="false"
        item-class="bg-transparent"
        :separator="true"
      />

      <q-card-section v-else class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No items</div>
        <div :class="ui.emptyCaptionClass">Go back and select items to include.</div>
      </q-card-section>

      <q-separator v-if="items.length" />

      <q-card-section v-if="items.length">
        <div class="row items-center justify-between">
          <span class="text-subtitle2 text-weight-bold">Items: {{ items.length }}</span>
          <span class="text-subtitle1 text-weight-bold text-primary">{{ totalQuantity }}</span>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AppList from 'components/app/AppList.vue'
import { useRequisitionFormContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'

defineOptions({ name: 'PurchaseRequisitionsAddRequisitionReview', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  form,
  items,
  warehouseName,
  skuLabelText,
  typeMeta,
  priorityMeta,
  currentStep, totalQuantity, editable
} = useRequisitionFormContext()

const visible = computed(() => editable.value && (props.step == null || Number(props.step) === currentStep.value))
</script>
