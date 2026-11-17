<template>
  <div v-if="!pending && terms.length">
    <SectionDividerLabel label="RFQ requirements" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div v-for="line in terms" :key="line.label" :class="ui.detailRowClass">
            <div class="row items-center justify-between" :class="ui.detailLineClass">
              <span :class="ui.detailKeyClass">{{ line.label }}</span>
              <span v-if="line.weight != null" :class="ui.detailValClass">Weight {{ line.weight }}</span>
              <span v-else :class="ui.detailValClass">{{ line.value }}</span>
            </div>
            <div v-if="line.method" class="text-caption text-grey-7">{{ line.method }}</div>
            <div v-for="option in line.options || []" :key="option.name" class="row justify-between items-start">
              <span class="col">{{ option.name }}
                <span v-if="option.description" class="text-caption text-grey-7 block">{{ option.description }}</span>
              </span>
              <span class="text-caption text-grey-7">{{ option.points }} points</span>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQSupplierView } from 'src/_ui/AQL/composables/Operation/RFQSuppliers/View/useRFQSupplierView'

defineOptions({ name: 'RFQSuppliersViewRequirements', inheritAttrs: false })
const { ui, terms, pending } = useRFQSupplierView()
</script>
