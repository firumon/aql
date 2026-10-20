<template>
  <q-card flat bordered :class="ui.cardClass">
    <q-card-section class="q-gutter-y-sm">
      <div class="text-subtitle1 text-weight-bold">Review Decision</div>
      <div v-if="!options.length" class="text-grey-7">No review action is available to you.</div>
      <template v-else>
        <component :is="SelectField" v-model="decision" :config="decisionConfig" header="Progress" />
        <component v-if="decision === 'Approved'" :is="CommentField" v-model="approvedComment"
          :config="approvalConfig" header="ProgressApprovedComment" />
        <component v-if="decision === 'Revision Required'" :is="CommentField" v-model="revisionComment"
          :config="revisionConfig" header="ProgressRevisionRequiredComment" />
        <component v-if="decision === 'Rejected'" :is="CommentField" v-model="rejectedComment"
          :config="rejectionConfig" header="ProgressRejectedComment" />
      </template>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useRequisitionReviewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Review/useRequisitionReviewContext'

defineOptions({ name: 'PurchaseRequisitionsReviewDecision', inheritAttrs: false })
const { ui, decision, approvedComment, revisionComment, rejectedComment, options } = useRequisitionReviewContext()
const SelectField = resolveFieldComponent('select', 'edit')
const CommentField = resolveFieldComponent('textarea', 'edit')
const decisionConfig = computed(() => ({ label: 'Progress', options: options.value, emitValue: true, mapOptions: true }))
const approvalConfig = { label: 'Approval note (optional)', rows: 4 }
const revisionConfig = { label: 'Changes needed', required: true, rows: 4 }
const rejectionConfig = { label: 'Reason for rejection', required: true, rows: 4 }
</script>
