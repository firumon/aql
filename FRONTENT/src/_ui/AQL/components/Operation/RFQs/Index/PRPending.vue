<template>
  <div v-if="metrics.length" :class="attrs.class"><MetricCards :gutter="gutter" :items="metrics" title="PR Pending" /></div>
</template>
<script setup>
import { useAttrs } from 'vue'
import MetricCards from 'components/sections/MetricCards.vue'
import { useRFQIndexContext } from 'src/_ui/AQL/composables/Operation/RFQs/Index/useRFQIndexContext'

defineOptions({ name: 'RFQsIndexPRPending', inheritAttrs: false })
defineProps({ gutter: { type: [String, Function], default: '' } })
const attrs = useAttrs()
const { metrics } = useRFQIndexContext()
</script>
