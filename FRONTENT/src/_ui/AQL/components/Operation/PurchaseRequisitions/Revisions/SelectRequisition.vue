<template>
  <div class="q-mb-md">
    <SectionDividerLabel label="Select Requisition to Revise" />

    <q-card v-if="loading" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">Loading requisitions...</q-card-section>
    </q-card>

    <q-card v-else-if="selectedCode && !selectedRecord" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="lock" size="40px" color="orange-9" class="q-mb-xs block q-mx-auto" />
        <div class="text-subtitle1 text-weight-bold text-grey-8">This requisition is not available for revision.</div>
        <div class="text-caption text-grey-6">Open its View page to see the saved details.</div>
      </q-card-section>
    </q-card>

    <q-card v-else-if="!revisionRequiredPRs.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="task_alt" size="40px" color="positive" class="q-mb-xs block q-mx-auto" />
        <div class="text-subtitle1 text-weight-bold text-grey-8">No Requisitions Need Revision</div>
        <div class="text-caption text-grey-6">All purchase requisitions are up to date or approved.</div>
      </q-card-section>
    </q-card>

    <q-card v-else flat bordered :class="ui.cardClass">
      <q-card-section class="q-py-xs">
        <AppList
          :items="revisionRequiredPRs"
          item-key="Code"
          selectable="left"
          v-model="selectedCodeArray"
          label="Code"
          :caption="(item) => [
            item.Type, item.Priority ? `Priority: ${item.Priority}` : '',
            item.WarehouseCode ? `WH: ${item.WarehouseCode}` : ''
          ].filter(Boolean).join(' · ')"
          meta-caption="PRDate"
          separator dense
          :item-bordered="false"
          item-class="bg-transparent"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AppList from 'components/app/AppList.vue'
import { useRequisitionFormSeed } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'
import { useRequisitionRevisionContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Revisions/useRequisitionRevisionContext'

defineOptions({ name: 'PurchaseRequisitionsRevisionsSelectRequisition', inheritAttrs: false })

useRequisitionFormSeed('revisions')

const {
  ui,
  loading,
  selectedCode,
  selectedRecord,
  revisionRequiredPRs,
  selectedCodeArray
} = useRequisitionRevisionContext()
</script>
