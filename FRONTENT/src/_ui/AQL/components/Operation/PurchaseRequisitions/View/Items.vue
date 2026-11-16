<template>
  <div :class="[attrs.class, gutterClass]">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="50%" class="q-mb-sm" />
        <q-skeleton type="text" width="90%" />
      </q-card-section>

      <q-card-section v-else-if="!rows.length" class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No items</div>
        <div :class="ui.emptyCaptionClass">Nothing has been requested on this requisition yet.</div>
      </q-card-section>

      <q-card-section v-else>
        <div v-for="(line, index) in rows" :key="line.code" :class="ui.detailRowClass" :style="rowDelay(index)">
          <div class="row items-start no-wrap q-mb-xs">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-body2 text-weight-medium">{{ line.primary }}</div>
              <div v-if="line.secondary && line.secondary !== line.primary" class="text-caption text-grey-6">
                {{ line.secondary }}
              </div>
              <div class="text-caption text-grey-7">Requested: {{ line.quantity }} {{ line.uom }}</div>
              <div class="text-caption text-grey-7">Quoted: {{ line.quotedQuantity }} {{ line.uom }}</div>
              <div v-if="line.rfqLinks?.length" class="row items-center">
                <q-chip v-for="rfq in line.rfqLinks" :key="rfq.code" dense outline icon="request_quote"
                  :clickable="canOpenRfq" :color="canOpenRfq ? 'primary' : 'grey-7'" @click="openRfq(rfq.code)">
                  {{ rfq.code }}
                </q-chip>
              </div>
            </div>
            <div class="col-auto text-right">
              <q-badge rounded outline :color="progressColor(line.Progress)" :label="progressLabel(line.Progress)" />
            </div>
          </div>
          <q-separator v-if="index < rows.length - 1" class="q-mb-sm" />
        </div>
        <q-separator class="q-my-sm" />
        <div class="row items-center justify-between text-weight-bold">
          <span>{{ totals.lines }} lines</span>
          <span>Requested: {{ totals.quantity }}</span>
          <span>Quoted: {{ totals.quotedQuantity }}</span>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRequisitionView } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionView'
import { useRequisitionViewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionViewContext'

defineOptions({ name: 'PurchaseRequisitionsViewItems', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Items Requested' },
  items: { type: Array, default: null }
})

const { evaluate, ui } = useRequisitionViewContext()
const { lines, totals, pending, progressLabel, progressColor, canOpenRfq, openRfq } = useRequisitionView()

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => (props.items === null ? lines.value : props.items))
const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
