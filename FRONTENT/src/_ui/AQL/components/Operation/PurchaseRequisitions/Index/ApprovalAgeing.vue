<template>
  <AgeingBuckets v-if="buckets.length" :items="buckets" title="Approval Queue Ageing" />
</template>

<script setup>
import AgeingBuckets from 'components/sections/AgeingBuckets.vue'
import { useRequisitionIndexContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Index/useRequisitionIndexContext'

defineOptions({ name: 'PurchaseRequisitionsIndexApprovalAgeing', inheritAttrs: false })
const { buckets } = useRequisitionIndexContext()
</script>
