<template>
  <div v-if="rows.length" :class="attrs.class">
    <DualDistributionBars v-bind="$attrs" title="Pending PRs by User" layout="inline"
      :items="rows" :series="series" :card-class="ui.cardClass" :row-stagger-ms="ui.rowStaggerMs" />
  </div>
</template>
<script setup>
import { useAttrs } from 'vue'
import DualDistributionBars from 'components/sections/DualDistributionBars.vue'
import { useRFQIndexContext } from 'src/_ui/AQL/composables/Operation/RFQs/Index/useRFQIndexContext'

defineOptions({ name: 'RFQsIndexPRUsers', inheritAttrs: false })
const attrs = useAttrs()
const { rows, series, ui } = useRFQIndexContext()
</script>
