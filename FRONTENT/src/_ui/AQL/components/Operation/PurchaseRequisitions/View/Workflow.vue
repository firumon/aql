<template>
  <div :class="[attrs.class, gutterClass]">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!events.length" class="text-center q-py-lg">
        <q-icon name="history" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing recorded yet</div>
        <div :class="ui.emptyCaptionClass">Workflow events appear here once the requisition is created.</div>
      </q-card-section>

      <q-card-section v-else>
        <q-timeline color="primary" layout="dense">
          <q-timeline-entry v-for="(event, index) in events" :key="event.state" :icon="event.icon" :color="event.color"
            :class="ui.detailRowClass" :style="rowDelay(index)">
            <template #title>
              <div class="row items-center no-wrap q-gutter-x-xs">
                <q-badge rounded :color="event.color" :label="event.label" />
                <span class="text-body2 text-weight-medium text-grey-8">{{ event.title }}</span>
              </div>
            </template>
            <template #subtitle>
              <span class="text-caption text-grey-7">
                <template v-if="event.by">By {{ event.by }}</template>
                <template v-if="event.at"> at {{ formatStampDate(event.at) }}</template>
              </span>
            </template>
            <div v-if="event.comment" class="text-caption text-italic text-grey-7" style="white-space: pre-line">
              {{ event.comment }}
            </div>
            <div v-if="event.rfqCodes?.length" class="row items-center">
              <q-chip v-for="rfq in event.rfqCodes" :key="rfq.code" dense outline icon="request_quote"
                :clickable="canOpenRfq" :color="canOpenRfq ? 'primary' : 'grey-7'" @click="openRfq(rfq.code)">
                {{ rfq.code }}
              </q-chip>
            </div>
          </q-timeline-entry>
        </q-timeline>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRequisitionView } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionView'
import { useRequisitionViewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionViewContext'

defineOptions({ name: 'PurchaseRequisitionsViewWorkflow', inheritAttrs: false })

const props = defineProps({ title: { type: [String, Function], default: 'Workflow Timeline' } })
const { evaluate, ui } = useRequisitionViewContext()
const { events, pending, formatStampDate, canOpenRfq, openRfq } = useRequisitionView()
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const finalTitle = computed(() => evaluate(props.title))
const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
