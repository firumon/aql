<template>
  <q-card flat bordered :class="ui.cardClass">
    <q-card-section>
      <div :class="ui.detailGridClass">
        <div v-for="line in lines" :key="line.label" :class="[ui.detailLineClass, ui.detailRowClass]">
          <span :class="ui.detailKeyClass">{{ line.label }}</span>
          <span :class="ui.detailValClass">{{ line.value }}</span>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import {
  useRequisitionReviewContext, useRequisitionReviewSeed
} from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Review/useRequisitionReviewContext'

defineOptions({ name: 'PurchaseRequisitionsReviewDetails', inheritAttrs: false })
useRequisitionReviewSeed()
const { ui, requisition, warehouseName } = useRequisitionReviewContext()

const lines = computed(() => {
  const record = requisition.value
  return [
    { label: 'PR Code', value: record.Code },
    { label: 'Progress', value: record.Progress },
    { label: 'PR Date', value: record.PRDate || '-' },
    { label: 'User', value: record.Username || '-' },
    { label: 'Required Date', value: record.RequiredDate || '-' },
    { label: 'Requisition Type', value: record.Type || '-' },
    { label: 'Priority', value: record.Priority || '-' },
    { label: 'Destination Warehouse', value: warehouseName.value },
    { label: 'Linked Procurement', value: record.ProcurementCode || 'Created on approval' }
  ]
})
</script>
