<template>
  <div v-if="rfqResponse.length" :class="attrs.class"><LinearProgress :items="rfqResponse" title="Supplier Response Rate" /></div>
</template>
<script setup>
import { useAttrs } from 'vue'
import LinearProgress from 'components/sections/LinearProgress.vue'
import { useRFQIndexContext } from 'src/_ui/AQL/composables/Operation/RFQs/Index/useRFQIndexContext'

defineOptions({ name: 'RFQsIndexSupplierResponse', inheritAttrs: false })
const attrs = useAttrs()
const { rfqResponse } = useRFQIndexContext()
</script>
