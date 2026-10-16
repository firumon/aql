<template>
  <AqlDialog
    :model-value="modelValue"
    persistent
    :title="title"
    :subtitle="subtitleText"
    icon="inventory_2"
    :disable-confirm="!selectedCodes.length"
    @update:model-value="$emit('update:modelValue', $event)"
    @confirm="close(true)"
    @cancel="close(false)"
  >
    <div>
      <q-input
        v-model="searchQuery"
        outlined
        clearable
        debounce="150"
        placeholder="Search by name, SKU code, variant, barcode..."
        class="bg-white q-mb-xs"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <div class="row items-center justify-between text-caption text-grey-7 q-pb-xs">
        <q-checkbox v-model="viewSelectedOnly" label="View Selected Only" />
        <q-btn
          v-if="filteredSkus.length"
          flat
          dense
          no-caps
          class="text-caption"
          color="primary"
          :label="isAllFilteredSelected ? 'Deselect Visible' : 'Select All Visible'"
          @click="toggleSelectFiltered"
        />
      </div>

      <q-separator />
    </div>

    <div v-if="filteredSkus.length" style="max-height: calc(62vh - 150px); overflow-y: auto;" class="q-pr-xs">
      <AppList
        v-model="selectedCodes"
        :items="filteredSkus"
        item-key="Code"
        selectable="left"
        :layout="['caption', 'label']"
        caption="skuCode"
        label="skuLabel"
      />
    </div>
    <div v-else class="column items-center justify-center q-pa-xl text-grey-6">
      <q-icon name="search_off" size="48px" class="q-mb-sm text-grey-4" />
      <div class="text-weight-medium">
        {{ viewSelectedOnly ? 'No items selected yet' : `No items match "${searchQuery}"` }}
      </div>
    </div>
  </AqlDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import AqlDialog from 'components/shared/AqlDialog.vue'
import AppList from 'components/app/AppList.vue'

defineOptions({ name: 'AqlSkuPicker' })

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Select Products / SKUs' },
  preselectedCodes: { type: Array, default: () => [] },
  skus: { type: Array, default: null }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const { activeSkus, skuLabelText } = useSkuResource()
const searchQuery = ref('')
const selectedCodes = ref([])
const viewSelectedOnly = ref(false)

const allSkus = computed(() => {
  if (props.skus?.length) return props.skus
  return activeSkus.value.map((sku) => ({
    ...sku,
    Code: sku.code,
    skuCode: sku.code,
    skuLabel: skuLabelText(sku.code),
    Barcode: sku.barcode,
    UOM: sku.uom
  }))
})

const skuByCodeMap = computed(() => new Map(allSkus.value.map((s) => [s.Code, s])))

const filteredSkus = computed(() => {
  let list = allSkus.value
  if (viewSelectedOnly.value) {
    const selectedSet = new Set(selectedCodes.value)
    list = list.filter((sku) => selectedSet.has(sku.Code))
  }

  const q = String(searchQuery.value || '').trim().toLowerCase()
  if (!q) return list

  return list.filter((sku) =>
    sku.skuCode?.toLowerCase().includes(q) ||
    sku.skuLabel?.toLowerCase().includes(q) ||
    sku.Barcode?.toLowerCase().includes(q)
  )
})

const selectedItems = computed(() =>
  selectedCodes.value.map((code) => skuByCodeMap.value.get(code)).filter(Boolean)
)

const isAllFilteredSelected = computed(() =>
  filteredSkus.value.length > 0 && filteredSkus.value.every((s) => selectedCodes.value.includes(s.Code))
)

const subtitleText = computed(() =>
  selectedCodes.value.length > 0
    ? `${selectedCodes.value.length} item${selectedCodes.value.length > 1 ? 's' : ''} in cart`
    : 'Pick items to add to your list'
)

function toggleSelectFiltered() {
  const visibleCodes = filteredSkus.value.map((s) => s.Code)
  if (isAllFilteredSelected.value) {
    selectedCodes.value = selectedCodes.value.filter((c) => !visibleCodes.includes(c))
  } else {
    selectedCodes.value = Array.from(new Set([...selectedCodes.value, ...visibleCodes]))
  }
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      searchQuery.value = ''
      viewSelectedOnly.value = false
      selectedCodes.value = Array.isArray(props.preselectedCodes) ? [...props.preselectedCodes] : []
    }
  }
)

function close(confirmed = false) {
  if (confirmed) emit('confirm', selectedItems.value, [...selectedCodes.value])
  else emit('cancel')
  emit('update:modelValue', false)
}
</script>
