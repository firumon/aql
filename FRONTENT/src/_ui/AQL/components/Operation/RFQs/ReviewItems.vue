<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="Items" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div v-if="!selectedItems.length" class="text-center q-py-lg">
          <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">Nothing selected</div>
          <div :class="ui.emptyCaptionClass">Go back and pick the lines this RFQ should cover.</div>
        </div>
        <div v-else :class="ui.detailGridClass">
          <div v-for="item in selectedItems" :key="item.code || item.sku" class="items-center" :class="ui.detailLineClass">
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
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsReviewItems', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const { ui, locked, currentStep, stepPlan, selectedItems } = useRFQAddContext()
const visible = computed(() => !locked.value && currentStep.value === Number(props.step ?? stepPlan.value.review))
</script>
