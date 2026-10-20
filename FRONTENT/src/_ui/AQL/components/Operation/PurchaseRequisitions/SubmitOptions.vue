<template>
  <div v-if="visible" :class="gutterClass">
    <template v-if="isDraftState">
      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <FieldToggleitemEdit
            :model-value="isDraft"
            :config="draftConfig"
            header="isDraft"
            @update:model-value="setDraft"
          />
        </q-card-section>
      </q-card>

      <q-card v-if="canApprove && !isDraft" flat bordered :class="ui.cardClass">
        <q-card-section>
          <FieldToggleitemEdit
            :model-value="isApproved"
            :config="approvedConfig"
            header="isApproved"
            @update:model-value="setApproved"
          />
        </q-card-section>
      </q-card>
    </template>

    <q-card v-else-if="isRevision" flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-gutter-sm">
          <q-icon name="info" color="info" size="20px" />
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle2 text-weight-medium">Ready to Resubmit</div>
            <div class="text-caption text-grey-8">
              Saving this form will send your updated requisition back to the approver.
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
const FieldToggleitemEdit = resolveFieldComponent('toggleitem', 'edit')
import { useRequisitionFormContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'

defineOptions({ name: 'PurchaseRequisitionsSubmitOptions', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui, isDraftState, isRevision, isDraft, setDraft, canApprove, isApproved, setApproved, pageState, editable
} = useRequisitionFormContext()

const visible = computed(() => editable.value && (props.step == null || Number(props.step) === (pageState?.meta?.currentStep || 1)))

const draftConfig = computed(() => ({
  label: 'Save as draft',
  caption: isDraft.value
    ? 'Keep this requisition private. It will not be sent for approval yet.'
    : isApproved.value ? 'This requisition will be approved when saved.' : 'This requisition will be sent for approval when saved.'
}))

const approvedConfig = computed(() => ({
  label: 'Approve now',
  caption: isApproved.value
    ? 'This requisition will be automatically approved upon saving.'
    : 'This requisition will be submitted for approval.'
}))
</script>
