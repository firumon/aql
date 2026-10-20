<template>
  <div class="row items-center no-wrap q-gutter-xs">
    <q-btn v-bind="ui.rowActionBtnProps" icon="visibility" color="grey-7" aria-label="View requisition" @click.stop="goToView">
      <q-tooltip>View Requisition</q-tooltip>
    </q-btn>

    <q-btn
      v-if="canEdit"
      v-bind="ui.rowActionBtnProps"
      icon="edit"
      color="primary"
      aria-label="Edit requisition"
      @click.stop="goToEdit"
    >
      <q-tooltip>Edit Requisition</q-tooltip>
    </q-btn>

    <AdditionalActionsButtons
      v-if="allowedActions.length"
      resource="PurchaseRequisitions" :record="item" :only="allowedActions"
    >
      <template #default="{ actions, open }">
        <q-btn
          v-for="action in actions" :key="action.action"
          v-bind="ui.rowActionBtnProps"
          :icon="action.icon || 'bolt'" :color="action.color || 'primary'"
          :aria-label="action.label || action.action"
          @click.stop="open(action)"
        >
          <q-tooltip>{{ action.label || action.action }}</q-tooltip>
        </q-btn>
      </template>
    </AdditionalActionsButtons>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AdditionalActionsButtons from 'components/app/AdditionalActionsButtons.vue'
import { useRequisitionIndexContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Index/useRequisitionIndexContext'

defineOptions({ name: 'PurchaseRequisitionsIndexRequisitionActionButtons' })

const props = defineProps({
  item: { type: Object, required: true }
})

const { nav, ui, canEdit: editable, rowActions } = useRequisitionIndexContext()
const canEdit = computed(() => editable(props.item))
const allowedActions = computed(() => rowActions(props.item))

function goToEdit () {
  nav.goTo('edit', { code: props.item?.Code })
}

function goToView () {
  nav.goTo('view', { code: props.item?.Code })
}
</script>
