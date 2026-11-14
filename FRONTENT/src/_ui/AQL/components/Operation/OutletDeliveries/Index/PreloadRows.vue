<template>
  <!-- Preloads rows for the index widgets. -->
</template>

<script setup>
import { onMounted } from 'vue'
import { useDeliveryQueueContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/Index/useDeliveryQueueContext'

defineOptions({ name: 'OutletDeliveriesIndexPreloadRows', inheritAttrs: false })

const { preload } = useDeliveryQueueContext()

onMounted(preload)
</script>
