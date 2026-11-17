<template>
  <div v-if="!locked && currentStep === Number(step) && showSourceChoice && eligibleRequisitions.length > 0" :class="gutterClass">
    <SectionDividerLabel label="Select From Pending PRs" />
    <q-card flat bordered :class="ui.cardClass">
      <AppList :items="eligibleRequisitions" item-key="Code" selectable="right" :model-value="selectedRequisitionCodes"
        :layout="['label', 'caption']" label="Code" caption="caption" :meta="['chip']" :meta-layout="['chip']"
        chip="chip" :chip-color="pr => pr.dueColor" :chip-outline="true"
        item-class="bg-transparent" :item-bordered="false" separator :paginate="false"
        @update:model-value="selectRequisition" />
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsSelectPendingPRs', inheritAttrs: false })
defineProps({ step: { type: [Number, String], default: 1 } })
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const { locked, currentStep, showSourceChoice, eligibleRequisitions, selectedRequisitionCodes,
  selectRequisition, ui } = useRFQAddContext()
</script>
