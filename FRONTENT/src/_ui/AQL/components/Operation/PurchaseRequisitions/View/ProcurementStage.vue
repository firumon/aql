<template>
  <div v-if="!pending && stage">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-gutter-sm">
          <q-icon :name="stage.icon" size="24px" :color="stage.color" />
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle2 text-weight-bold">{{ stage.label }}</div>
            <div class="text-caption text-grey-6">{{ stage.code }}</div>
          </div>
        </div>

      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRequisitionView } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionView'
import { useRequisitionViewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionViewContext'

defineOptions({ name: 'PurchaseRequisitionsViewProcurementStage', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Procurement Stage' }
})

const { evaluate, ui } = useRequisitionViewContext()
const { procurementStage, pending } = useRequisitionView()

const finalTitle = computed(() => evaluate(props.title))
const stage = computed(() => procurementStage.value)
</script>
