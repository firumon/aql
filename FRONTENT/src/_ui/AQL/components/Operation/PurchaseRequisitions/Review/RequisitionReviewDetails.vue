<template>
  <q-card flat bordered :class="ui.cardClass">
    <q-card-section>
      <div :class="ui.detailGridClass">
        <div :class="[ui.detailLineClass, ui.detailRowClass]">
          <span :class="ui.detailKeyClass">PR Code</span>
          <span :class="ui.detailValClass">{{ requisition.Code }}</span>
        </div>

        <div :class="[ui.detailLineClass, ui.detailRowClass]">
          <span :class="ui.detailKeyClass">Progress</span>
          <span :class="ui.detailValClass">{{ requisition.Progress }}</span>
        </div>

        <div :class="[ui.detailLineClass, ui.detailRowClass]">
          <span :class="ui.detailKeyClass">PR Date</span>
          <span :class="ui.detailValClass">{{ requisition.PRDate || '-' }}</span>
        </div>

        <div :class="[ui.detailLineClass, ui.detailRowClass]">
          <span :class="ui.detailKeyClass">Required Date</span>
          <span :class="ui.detailValClass">{{ requisition.RequiredDate || '-' }}</span>
        </div>

        <div :class="[ui.detailLineClass, ui.detailRowClass]">
          <span :class="ui.detailKeyClass">Requisition Type</span>
          <span :class="ui.detailValClass">{{ requisition.Type || '-' }}</span>
        </div>

        <div :class="[ui.detailLineClass, ui.detailRowClass]">
          <span :class="ui.detailKeyClass">Priority</span>
          <span :class="ui.detailValClass">{{ requisition.Priority || '-' }}</span>
        </div>

        <div :class="[ui.detailLineClass, ui.detailRowClass]">
          <span :class="ui.detailKeyClass">Destination Warehouse</span>
          <span :class="ui.detailValClass">{{ warehouseName }}</span>
        </div>

        <div :class="[ui.detailLineClass, ui.detailRowClass]">
          <span :class="ui.detailKeyClass">Linked Procurement</span>
          <span :class="ui.detailValClass">{{ requisition.ProcurementCode || 'Created on approval' }}</span>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import {
  useRequisitionReviewContext, useRequisitionReviewSeed
} from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Review/useRequisitionReviewContext'

defineOptions({ name: 'PurchaseRequisitionsReviewDetails', inheritAttrs: false })
useRequisitionReviewSeed()
const { ui, requisition, warehouseName } = useRequisitionReviewContext()
</script>
