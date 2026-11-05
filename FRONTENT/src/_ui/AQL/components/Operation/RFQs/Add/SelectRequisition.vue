<template>
  <div v-if="visible" :class="gutterClass">
    <!-- Sourcing path option -->
    <q-card v-if="showSourceChoice" flat bordered :class="ui.cardClass">
      <q-card-section>
        <ToggleItemField
          v-model="isDirectToggle"
          :config="{
            title: 'Direct RFQ',
            caption: 'Turn on to select items directly. Turn off to create the RFQ from a selected PR and its items.'
          }"
        />
      </q-card-section>
    </q-card>

    <!-- Path 1: From PR -->
    <template v-if="sourceType === 'PR'">
      <SectionDividerLabel label="Select Purchase Requisition" />

      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <q-skeleton v-if="itemsLoading" type="text" />
          <div v-else-if="!eligibleRequisitions.length" class="text-center q-py-lg">
            <q-icon name="inbox" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
            <div :class="ui.emptyTitleClass">Nothing to source</div>
            <div :class="ui.emptyCaptionClass">No approved requisition is waiting for an RFQ.</div>
          </div>

          <AppList
            v-else
            v-model="selectedRequisition"
            :items="displayedRequisitions"
            item-key="code"
            selectable="left"
            :layout="['caption', 'label', 'caption']"
            :content="['top', 'code', 'bottom']"
            separator
            dense
            :item-bordered="false"
            item-class="bg-transparent"
          />

          <div v-if="selectedRequisitionCode" class="row justify-end q-mt-sm">
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              :icon="prListCollapsed ? 'expand_more' : 'expand_less'"
              :label="prListCollapsed ? 'Expand list' : 'Collapse list'"
              @click="prListCollapsed = !prListCollapsed"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- Active PR items with editable descriptions -->
      <template v-if="selectedRequisitionCode">
        <SectionDividerLabel label="Item descriptions" />

        <q-card flat bordered :class="ui.cardClass">
          <q-card-section :class="gutterClass">
            <div class="text-caption text-grey-7">Changes also update the source PR.</div>
            <div v-if="!availableItems.length" class="text-center q-py-lg">
              <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
              <div :class="ui.emptyTitleClass">No items to quote</div>
              <div :class="ui.emptyCaptionClass">This requisition has no active items.</div>
            </div>

            <template v-else>
              <div v-for="item in availableItems" :key="item.code" :class="gutterClass">
                <div class="row items-center justify-between no-wrap">
                  <span class="text-weight-medium" :class="ui.flexWrapTextClass">
                    {{ item.skuRecord?.variantValues?.filter(Boolean).join(' / ')
                      ? `${item.primary} / ${item.skuRecord.variantValues.filter(Boolean).join(' / ')}`
                      : item.primary }}
                  </span>
                  <span class="text-body2 text-grey-8">{{ item.quantity }} {{ item.uom }}</span>
                </div>
                <TextareaField
                  :model-value="itemDescription(item.code)"
                  :config="{ label: 'Item description', rows: 2 }"
                  @update:model-value="(value) => setItemDescription(item.code, value)"
                />
              </div>
            </template>
          </q-card-section>
        </q-card>
      </template>
    </template>

    <!-- Quotation Submission Deadline -->
    <q-card v-if="sourceType === 'DIRECT' || selectedRequisitionCode" flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Quotation submission deadline</div>
        <DateField
          :model-value="record.QuotationSubmissionDeadline"
          :record="record"
          :config="{ label: 'Quotation Submission Deadline' }"
          header="QuotationSubmissionDeadline"
          @update:model-value="(value) => setField('QuotationSubmissionDeadline', value)"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsAddSelectRequisition', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const ToggleItemField = resolveFieldComponent('toggleitem', 'add')
const DateField = resolveFieldComponent('date', 'add')
const TextareaField = resolveFieldComponent('textarea', 'add')

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  record,
  setField,
  showSourceChoice,
  sourceType,
  isDirectToggle,
  prListCollapsed,
  eligibleRequisitions,
  displayedRequisitions,
  selectedRequisition,
  selectedRequisitionCode,
  availableItems,
  itemDescription,
  setItemDescription,
  itemsLoading,
  currentStep
} = useRFQAddContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)
</script>
