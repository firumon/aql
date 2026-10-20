<template>
  <MetricCards v-if="cards.length" :items="cards" title="Sourcing Status" />
</template>

<script setup>
import MetricCards from 'components/sections/MetricCards.vue'
import { useRequisitionIndexContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Index/useRequisitionIndexContext'

defineOptions({ name: 'PurchaseRequisitionsIndexSourcingCards', inheritAttrs: false })
const { sourcingCards: cards } = useRequisitionIndexContext()
</script>
