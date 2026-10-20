<template>
  <div>
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
        <AppList
          label="primary" caption="secondary"
          :items="listItems"
          :metaLabel="(row) => `${row.quantity} ${row.uom}`"
          itemClass="bg-transparent"
          :itemBordered="false"
          :separator="true"
          dense
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRequisitionView } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionView'
import { useRequisitionViewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionViewContext'
import AppList from 'components/app/AppList.vue'

defineOptions({ name: 'PurchaseRequisitionsViewItems', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Items Requested' },
  items: { type: Array, default: null }
})

const { evaluate, ui } = useRequisitionViewContext()
const { lines, totals, pending } = useRequisitionView()

const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => (props.items === null ? lines.value : props.items))
const listItems = computed(() => [...rows.value, {
  primary: `${totals.value.lines} lines`, secondary: null, quantity: totals.value.quantity, uom: 'units'
}])

</script>
