<template>
  <div v-if="metricCards.length" :class="attrs.class">
    <MetricCards :gutter="gutter" :items="metricCards" title="Requisition Overview" />
  </div>
</template>

<script setup>
import { useAttrs } from 'vue'
import MetricCards from 'components/sections/MetricCards.vue'
import { useRequisitionIndexContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Index/useRequisitionIndexContext'

defineOptions({ name: 'PurchaseRequisitionsIndexRequisitionMetrics', inheritAttrs: false })
defineProps({ gutter: { type: [String, Function], default: '' } })
const attrs = useAttrs()
const { metricCards } = useRequisitionIndexContext()
</script>
