<template>
  <div v-if="selectedRecord" class="q-mb-md">
    <SectionDividerLabel label="Approver Feedback & Notes" />

    <q-card flat bordered :class="[ui.cardClass, ui.accentCardClass]" :style="ui.accentBorderStyle" class="q-mb-sm">
      <q-card-section>
        <div class="row items-start no-wrap q-gutter-x-sm">
          <q-icon name="undo" size="24px" color="orange" class="q-mt-xs" />
          <div class="col">
            <div class="row items-center justify-between">
              <span class="text-subtitle2 text-weight-bold text-orange-9">Revision Requested</span>
              <span v-if="approverAt" class="text-caption text-grey-6">{{ approverAt }}</span>
            </div>
            <div v-if="approverBy" class="text-caption text-grey-8 text-weight-medium">
              Requested by: {{ approverBy }}
            </div>
            <div class="text-body2 text-grey-9 q-mt-xs" style="white-space: pre-wrap;">
              {{ approverComment || 'Approver requested changes before approval.' }}
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <q-input
          v-model="responseComment"
          type="textarea"
          outlined
          label="Response Note to Approver (Optional)"
          placeholder="e.g. Updated item quantities and added requested products..."
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRequisitionRevisionContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Revisions/useRequisitionRevisionContext'

defineOptions({ name: 'PurchaseRequisitionsRevisionsComments', inheritAttrs: false })

const {
  ui,
  selectedRecord,
  approverComment,
  approverBy,
  approverAt,
  responseComment
} = useRequisitionRevisionContext()
</script>
