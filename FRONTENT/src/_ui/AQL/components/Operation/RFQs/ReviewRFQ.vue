<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="What will be sent" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in summary"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <SectionDividerLabel label="Items" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div v-if="!selectedItems.length" class="text-center q-py-lg">
          <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">Nothing selected</div>
          <div :class="ui.emptyCaptionClass">Go back and pick the lines this RFQ should cover.</div>
        </div>
        <div v-else :class="ui.detailGridClass">
          <div
            v-for="item in displayItems"
            :key="item.code || item.sku"
            class="items-center"
            :class="ui.detailLineClass"
          >
            <span :class="[ui.detailKeyClass, ui.flexWrapTextClass]">
              {{ item.variant ? `${item.primary} / ${item.variant}` : item.primary }}
              <span v-if="item.description" class="text-caption block">
                {{ item.description }}
              </span>
            </span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ item.quantity }} {{ item.uom }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <template v-if="!isEditing">
      <SectionDividerLabel label="Suppliers" />
      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <div v-if="!selectedSupplierCodes.length" :class="ui.emptyTitleClass">No supplier selected</div>
          <template v-else>
            <div class="text-caption text-grey-7 q-mb-sm">Total suppliers: {{ selectedSupplierCodes.length }}</div>
            <AppList dense separator :items="add.selectedSuppliers.value" item-key="Code" label="Name"
              :label-class="ui.flexWrapTextClass" :paginate="false" :gutter="false" :item-bordered="false"
              item-class="bg-transparent" />
          </template>
        </q-card-section>
      </q-card>
    </template>

    <q-expansion-item
      v-if="terms.length"
      dense
      icon="tune"
      label="Commercial terms"
      :caption="`${terms.length} terms set`"
    >
      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <div :class="ui.detailGridClass">
            <div v-for="line in terms" :key="line.label" class="items-center" :class="ui.detailLineClass">
              <span :class="ui.detailKeyClass">{{ line.label }}</span>
              <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-expansion-item>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQFormContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQFormContext'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsReviewRFQ', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null },
  mode: { type: String, default: 'add' }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const form = useRFQFormContext()
const add = props.mode === 'edit' ? null : useRFQAddContext()
const { getSku } = useSkuResource()
const ui = form.ui
const record = form.record
const currentStep = form.currentStep
const stepPlan = form.stepPlan
const criterionTerms = form.criterionTerms
const isEditing = computed(() => props.mode === 'edit' || form.editing.value)
const prItems = form.requisitionItems
const selectedItems = computed(() => isEditing.value ? editItems.value : add.selectedItems.value)
const editItems = computed(() => prItems.value.map((item) => ({ ...item, skuRecord: getSku(item.sku) })))
const requisitionCode = computed(() => String(record.value.PurchaseRequisitionCode || ''))
const requisition = computed(() => requisitionCode.value ? { Code: requisitionCode.value } : null)
const sourceType = computed(() => isEditing.value
  ? (requisitionCode.value ? 'PR' : 'DIRECT')
  : add.sourceType.value)
const selectedSupplierCodes = computed(() => isEditing.value ? [] : add.selectedSupplierCodes.value)
const totals = computed(() => selectedItems.value.reduce((result, item) => {
  result.lines += 1
  result.quantity += Number(item.quantity) || 0
  return result
}, { lines: 0, quantity: 0 }))

const visible = computed(() => Number(props.step ?? stepPlan.value.review) === currentStep.value)

const summary = computed(() => [
  { label: 'Source', value: sourceType.value === 'DIRECT' ? 'Direct Sourcing' : 'From PR' },
  { label: 'Requisition', value: sourceType.value === 'DIRECT' ? 'Direct (No PR)' : requisition.value?.Code || '—' },
  { label: 'Items', value: `${totals.value.lines} lines · ${totals.value.quantity} units` },
  { label: 'Suppliers', value: isEditing.value ? '' : selectedSupplierCodes.value.length || 'None yet' },
  { label: 'RFQ Date', value: record.value.RFQDate },
  { label: 'Deadline', value: record.value.QuotationSubmissionDeadline }
].filter((line) => String(line.value ?? '').trim()))

const terms = criterionTerms

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
const displayItems = computed(() => selectedItems.value.map((item) => ({
  ...item,
  description: sourceType.value === 'DIRECT'
    ? item.description || ''
    : form.itemDescription(item.code),
  variant: sourceType.value === 'DIRECT'
    ? item.secondary
    : (item.skuRecord?.variantValues || []).filter(Boolean).join(' / ')
})))
</script>
