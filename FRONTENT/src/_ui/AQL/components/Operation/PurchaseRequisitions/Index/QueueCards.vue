<template>
  <MetricCards v-if="cards.length" :items="cards" title="Action Required" />
</template>

<script setup>
import MetricCards from 'components/sections/MetricCards.vue'
import { useRequisitionIndexContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Index/useRequisitionIndexContext'

defineOptions({ name: 'PurchaseRequisitionsIndexQueueCards', inheritAttrs: false })
const { queueCards: cards } = useRequisitionIndexContext()
</script>
