<template>
  <div v-if="locked">
    <q-banner dense rounded class="bg-orange-2">
      <template #avatar>
        <q-icon name="lock" color="orange-9" />
      </template>
      This requisition has moved on and can no longer be edited. Nothing typed here will save.
    </q-banner>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRequisitionFormContext, useRequisitionFormSeed } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'

defineOptions({ name: 'PurchaseRequisitionsEditLockBanner', inheritAttrs: false })


useRequisitionFormSeed('edit')

const { resourceRecord, editable } = useRequisitionFormContext()

// A blank record is still hydrating — say nothing until there is something to lock.
const locked = computed(() => !!resourceRecord?.record?.value?.Code && !editable.value)
</script>
