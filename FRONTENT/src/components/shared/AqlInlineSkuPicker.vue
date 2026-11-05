<template>
  <AqlInlineMasterPicker v-bind="$attrs" :model-value="modelValue" :items="skuOptions" :dense="dense" :filter-dense="filterDense"
    input :input-label="label" :type="type" :value="value" :disable="disable" :loading="loading"
    filter-label="Filter by product name" :list-props="{ label: 'label', caption: 'value', labelClass: 'ellipsis', ...$attrs }"
    @update:model-value="emit('update:modelValue', $event)">
    <template #selected-items><slot name="selected-items" /></template>
  </AqlInlineMasterPicker>
</template>

<script setup>
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import AqlInlineMasterPicker from 'components/shared/AqlInlineMasterPicker.vue'

defineOptions({ name: 'AqlInlineSkuPicker', inheritAttrs: false })

defineProps({
  modelValue: { type: Object, default: () => ({}) },
  dense: { type: Boolean, default: false },
  filterDense: { type: Boolean, default: null },
  type: { type: String, default: 'text' },
  label: { type: [String, Number, Function], default: 'Value' },
  value: { type: [String, Number], default: '' },
  disable: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])
const { skuOptions } = useSkuResource()
</script>
