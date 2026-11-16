<template>
  <div :class="[attrs.class, gutterClass]">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!requisition" class="text-center q-py-lg">
        <q-icon name="request_quote" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No requisition</div>
        <div :class="ui.emptyCaptionClass">This record could not be loaded.</div>
      </q-card-section>

      <q-card-section v-else>
        <div :class="ui.detailGridClass">
          <div class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(0)">
            <span :class="ui.detailKeyClass">Progress</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <q-icon :name="statusIcon" size="16px" :color="statusColor" class="q-mr-xs" />
              <q-chip rounded :color="statusColor" :label="statusLabel" dark />
            </span>
          </div>

          <div
            v-for="(line, index) in lines"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index + 1)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <FieldRemarksView v-if="line.label === 'Remarks'" :model-value="line.value" header="Remarks" />
              <template v-else>{{ line.value }}</template>
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRequisitionView } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionView'
import { useRequisitionViewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionViewContext'

defineOptions({ name: 'PurchaseRequisitionsViewRequisitionHeader', inheritAttrs: false })
const FieldRemarksView = resolveFieldComponent('textarea', 'view')

const props = defineProps({
  title: { type: [String, Function], default: 'Requisition Details' },
  color: { type: [String, Function], default: null }
})

const { evaluate, ui } = useRequisitionViewContext()
const {
  requisition,
  pending,
  overdue,
  progressColor,
  progressIcon,
  progressLabel
} = useRequisitionView()

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() => evaluate(props.color) || progressColor(requisition.value?.Progress))
const statusIcon = computed(() => progressIcon(requisition.value?.Progress))
const statusLabel = computed(() => progressLabel(requisition.value?.Progress))

const lines = computed(() => {
  const record = requisition.value
  if (!record) return []
  return [
    { label: 'Code', value: record.Code },
    { label: 'PR Date', value: record.PRDate },
    { label: 'Required By', value: [record.RequiredDate, overdue.value ? 'Past required date' : ''].filter(Boolean).join(' • ') },
    { label: 'Requested By', value: record.Username },
    { label: 'Remarks', value: record.Remarks }
  ].filter((line) => String(line.value ?? '').trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
