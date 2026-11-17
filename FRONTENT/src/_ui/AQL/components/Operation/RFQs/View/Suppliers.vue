<template>
  <div :class="[attrs.class, `q-gutter-y-${attrs.gutter || 'sm'}`]">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="50%" class="q-mb-sm" />
        <q-skeleton type="text" width="90%" />
      </q-card-section>

      <q-card-section v-else-if="!rows.length" class="text-center q-py-lg">
        <q-icon name="group_add" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No suppliers yet</div>
        <div :class="ui.emptyCaptionClass">Assign suppliers before this RFQ can go out for quoting.</div>
      </q-card-section>

      <q-card-section v-else>
        <div class="row items-center q-gutter-xs q-mb-sm">
          <q-chip dense square color="grey-3" text-color="grey-9" :label="`${counts.active} assigned`" />
          <q-chip v-if="counts.cancelled" dense square color="grey-5" text-color="white" :label="`${counts.cancelled} cancelled`" />
          <q-chip v-if="counts.assigned" dense square color="warning" text-color="white" :label="`${counts.assigned} not sent`" />
          <q-chip v-if="counts.responded" dense square color="positive" text-color="white" :label="`${counts.responded} responded`" />
        </div>

        <div :class="ui.detailGridClass">
          <div
            v-for="(row, index) in rows"
            :key="row.code"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="[ui.detailKeyClass, ui.flexWrapTextClass]">
              {{ row.name }}
              <span v-if="row.country" class="text-caption text-grey-6 block">{{ row.country }}</span>
              <span v-if="row.sentComment" class="text-caption text-grey-7 block">Send: {{ row.sentComment }}</span>
              <span v-if="row.respondedComment" class="text-caption text-grey-7 block">Reply: {{ row.respondedComment }}</span>
              <span v-if="row.cancelledComment" class="text-caption text-grey-7 block">Cancelled: {{ row.cancelledComment }}</span>
            </span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <span v-if="row.sentDate" class="text-caption text-grey-6 q-mr-xs">{{ row.sentDate }}</span>
              <q-badge rounded :color="supplierProgressColor(row.progress)" :label="supplierProgressLabel(row.progress)" />
            </span>
          </div>
        </div>

        <q-banner v-if="counts.assigned && !isTerminal(rfq)" dense rounded class="bg-grey-2 q-mt-sm text-caption">
          Suppliers still marked as assigned have not been sent the RFQ yet.
        </q-banner>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { isTerminal } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQView } from 'src/_ui/AQL/composables/Operation/RFQs/View/useRFQView'
import { useRFQViewContext } from 'src/_ui/AQL/composables/Operation/RFQs/View/useRFQViewContext'

defineOptions({ name: 'RFQsViewSuppliers', inheritAttrs: false })

const attrs = useAttrs()
const props = defineProps({
  title: { type: [String, Function], default: 'Suppliers' },
  items: { type: Array, default: null }
})

const { evaluate, ui } = useRFQViewContext()
const { rfq, supplierRows, supplierCounts, pending, supplierProgressColor, supplierProgressLabel } = useRFQView()

const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => (props.items === null ? supplierRows.value : props.items))
const counts = computed(() => supplierCounts.value)

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
