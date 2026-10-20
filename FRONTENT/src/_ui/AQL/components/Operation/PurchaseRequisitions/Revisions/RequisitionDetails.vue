<template>
  <div v-if="selectedRecord" class="q-mb-md">
    <SectionDividerLabel label="Requisition Header Details" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-6">
            <FieldSelectEdit v-model="prType" :record="form" :config="typeConfig" header="Type" />
          </div>

          <div class="col-12 col-sm-6">
            <FieldSelectEdit v-model="prPriority" :record="form" :config="priorityConfig" header="Priority" />
          </div>

          <div class="col-12 col-sm-6">
            <q-input
              :model-value="warehouseName || '—'"
              readonly
              outlined
              label="Warehouse"
            />
          </div>

          <div class="col-12 col-sm-6">
            <q-input
              :model-value="selectedRecord?.PRDate || '—'"
              readonly
              outlined
              label="PR Date"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRequisitionRevisionContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Revisions/useRequisitionRevisionContext'

defineOptions({ name: 'PurchaseRequisitionsRevisionsDetails', inheritAttrs: false })

const {
  ui,
  selectedRecord, form,
  prType,
  prPriority,
  warehouseName,
  typeOptions,
  priorityOptions
} = useRequisitionRevisionContext()

const FieldSelectEdit = resolveFieldComponent('select', 'edit')
const typeConfig = { label: 'Type *', options: typeOptions }
const priorityConfig = { label: 'Priority *', options: priorityOptions }
</script>
