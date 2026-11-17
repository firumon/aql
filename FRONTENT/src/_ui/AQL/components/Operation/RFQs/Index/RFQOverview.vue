<template>
  <div v-if="rfqMetrics.length" :class="attrs.class"><MetricCards :gutter="gutter" :items="rfqMetrics" title="RFQ Overview" /></div>
</template>
<script setup>
import { useAttrs } from 'vue'
import MetricCards from 'components/sections/MetricCards.vue'
import { useRFQIndexContext } from 'src/_ui/AQL/composables/Operation/RFQs/Index/useRFQIndexContext'

defineOptions({ name: 'RFQsIndexRFQOverview', inheritAttrs: false })
defineProps({ gutter: { type: [String, Function], default: '' } })
const attrs = useAttrs()
const { rfqMetrics } = useRFQIndexContext()
</script>
