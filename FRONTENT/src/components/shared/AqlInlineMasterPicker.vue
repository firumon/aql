<template>
  <q-card :flat="flat" :class="$attrs.class" :style="$attrs.style" :inert="disable || loading">
    <q-card-section>
      <q-input v-model="searchQuery" :dense="filterDense ?? dense" outlined clearable type="search" :label="filterLabel"
        :disable="disable || loading">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
    </q-card-section>
    <q-card-section class="q-px-sm q-pb-sm q-pt-none">
      <AppList v-bind="{ bordered: false, 'item-bordered': false, gutter: false, paginate: false, separator: true, ...listProps, ...$attrs }"
        :dense="dense" :input="input" selectable="left" :item-key="itemKey"
        :val="item => String(getItemVal(item, null, itemKey))" class="scroll"
        :style="{ maxHeight: dense ? '168px' : '264px' }" :items="filteredOptions"
        :model-value="selectedCodes" :loading="loading"
        :input-label="inputLabel" :input-value="() => value"
        :input-props="item => ({ type, modelValue: valueFor(String(getItemVal(item, null, itemKey))), disable: disable || loading,
          'aria-label': String(typeof searchBy === 'function' ? searchBy(item) : item[searchBy] ?? ''),
          style: 'width: 7rem; max-width: 30vw', rows: 1,
          ...(typeof inputProps === 'function' ? inputProps(item) : inputProps) })"
        @update:model-value="setSelected" @input-change="setValue($event.itemKeyValue, $event.value)" />
    </q-card-section>
    <slot name="selected-items" />
  </q-card>
</template>

<script setup>
import { toRef } from 'vue'
import AppList from 'components/app/AppList.vue'
import { getItemVal } from 'components/abstract/ListCheckbox.vue'
import { useInlineSkuPicker } from 'src/composables/useInlineSkuPicker'

defineOptions({ name: 'AqlInlineMasterPicker', inheritAttrs: false })

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  items: { type: Array, default: () => [] },
  itemKey: { type: [String, Function], default: 'value' },
  searchBy: { type: [String, Function], default: 'label' },
  filterLabel: { type: String, default: 'Filter by name' },
  listProps: { type: Object, default: () => ({}) },
  flat: { type: Boolean, default: false },
  dense: { type: Boolean, default: false },
  filterDense: { type: Boolean, default: null },
  input: { type: [Boolean, String, Object, Function], default: false },
  inputProps: { type: [Object, Function], default: () => ({}) },
  inputLabel: { type: [String, Number, Function], default: 'Value' },
  type: { type: String, default: 'text' },
  value: { type: [String, Number], default: '' },
  disable: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])
const { searchQuery, filteredOptions, selectedCodes, valueFor, setSelected, setValue } =
  useInlineSkuPicker(props, emit, toRef(props, 'items'))
</script>
