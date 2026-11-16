<template>
  <div v-if="userSummary.length" :class="attrs.class">
    <DualDistributionBars title="Active PRs by User" layout="inline" :items="userSummary" :series="userSummarySeries"
      :card-class="ui.cardClass" :row-stagger-ms="ui.rowStaggerMs" />
  </div>
</template>

<script setup>
import { useAttrs } from 'vue'
import DualDistributionBars from 'components/sections/DualDistributionBars.vue'
import { useRequisitionIndexContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Index/useRequisitionIndexContext'

defineOptions({ name: 'PurchaseRequisitionsIndexUserSummary', inheritAttrs: false })
const attrs = useAttrs()
const { userSummary, userSummarySeries, ui } = useRequisitionIndexContext()
</script>
