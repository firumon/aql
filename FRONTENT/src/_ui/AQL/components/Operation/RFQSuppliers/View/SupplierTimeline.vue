<template>
  <div v-if="!pending && row">
    <SectionDividerLabel label="RFQ supplier" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center justify-between">
          <div>
            <div class="text-subtitle1 text-weight-medium">{{ supplier?.Name || row.SupplierCode }}</div>
            <div class="text-caption text-grey-7">RFQ {{ row.RFQCode }}</div>
          </div>
          <q-badge rounded :color="supplierProgressColor(row.Progress)" :label="supplierProgressLabel(row.Progress)" />
        </div>
      </q-card-section>
      <q-card-section class="row items-center justify-center q-gutter-sm">
        <q-card flat bordered class="col-12 col-sm">
          <q-card-section>
            <div class="text-caption text-grey-7">Assigned</div>
            <div class="text-weight-medium">{{ formatDate(timeline.assigned) }}</div>
            <div v-if="timeline.assignedBy" class="text-caption text-grey-7">By {{ timeline.assignedBy }}</div>
          </q-card-section>
        </q-card>
        <q-icon name="arrow_forward" color="grey-6" size="sm" class="gt-xs" />
        <q-icon name="arrow_downward" color="grey-6" size="sm" class="lt-sm" />
        <q-card flat bordered class="col-12 col-sm">
          <q-card-section>
            <div class="text-caption text-grey-7">Sent</div>
            <div class="text-weight-medium">{{ formatDate(timeline.sent) }}</div>
            <div v-if="timeline.sendDays != null" class="text-caption text-grey-7">{{ timeline.sendDays }} days after assignment</div>
            <div v-if="timeline.inferred" class="text-caption text-grey-7">Send inferred from reply</div>
            <div v-if="timeline.recordedAt" class="text-caption text-grey-7">
              Recorded {{ formatDate(timeline.recordedAt, true) }}<template v-if="timeline.recordedBy"> by {{ timeline.recordedBy }}</template>
            </div>
          </q-card-section>
        </q-card>
        <q-icon name="arrow_forward" color="grey-6" size="sm" class="gt-xs" />
        <q-icon name="arrow_downward" color="grey-6" size="sm" class="lt-sm" />
        <q-card flat bordered class="col-12 col-sm">
          <q-card-section>
            <div class="text-caption text-grey-7">Supplier replied</div>
            <div class="text-weight-medium">
              {{ timeline.response ? formatDate(timeline.response) : (timeline.responseRecordedAt ? formatDate(timeline.responseRecordedAt) : (row.Progress === 'RESPONDED' ? 'Date unavailable' : 'Not recorded')) }}
            </div>
            <div v-if="timeline.responseFromRecordedAt" class="text-caption text-grey-7">Reply recorded in AQL</div>
            <div v-if="timeline.responseDays != null" class="text-caption text-grey-7">{{ timeline.responseDays }} days {{ timeline.responseFromRecordedAt ? 'until reply was recorded' : 'until supplier replied' }}</div>
            <div v-if="timeline.responseRecordedAt" class="text-caption text-grey-7">
              Recorded {{ formatDate(timeline.responseRecordedAt, true) }}<template v-if="timeline.responseRecordedBy"> by {{ timeline.responseRecordedBy }}</template>
            </div>
          </q-card-section>
        </q-card>
        <q-icon name="arrow_forward" color="grey-6" size="sm" class="gt-xs" />
        <q-icon name="arrow_downward" color="grey-6" size="sm" class="lt-sm" />
        <q-card flat bordered class="col-12 col-sm">
          <q-card-section>
            <div class="text-caption text-grey-7">Cancelled</div>
            <div class="text-weight-medium">{{ formatDate(timeline.cancelled) }}</div>
            <div v-if="timeline.cancelledBy" class="text-caption text-grey-7">By {{ timeline.cancelledBy }}</div>
            <div v-if="timeline.cancelledComment" class="text-caption text-grey-7">{{ timeline.cancelledComment }}</div>
          </q-card-section>
        </q-card>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQSupplierView } from 'src/_ui/AQL/composables/Operation/RFQSuppliers/View/useRFQSupplierView'

defineOptions({ name: 'RFQSuppliersViewSupplierTimeline', inheritAttrs: false })
const { ui, row, supplier, pending, timeline, formatDate, supplierProgressLabel, supplierProgressColor } = useRFQSupplierView()
</script>
