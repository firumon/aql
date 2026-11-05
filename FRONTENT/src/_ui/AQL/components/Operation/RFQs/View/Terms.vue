<template>
  <div v-if="!pending && terms.length">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div v-for="(line, index) in terms" :key="line.label" :class="ui.detailRowClass" :style="rowDelay(index)">
            <div class="row items-center justify-between" :class="ui.detailLineClass">
              <span :class="ui.detailKeyClass">{{ line.label }}</span>
              <span v-if="line.weight != null" :class="ui.detailValClass">Weight {{ line.weight }}</span>
              <span v-else :class="ui.detailValClass">{{ line.value }}</span>
            </div>
            <div v-if="line.method" class="text-caption text-grey-7">{{ line.method }}</div>
            <div v-for="option in line.options || []" :key="option.name" class="row justify-between items-start">
              <span class="col">
                {{ option.name }}
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
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQView } from 'src/_ui/AQL/composables/Operation/RFQs/View/useRFQView'
import { useRFQViewContext } from 'src/_ui/AQL/composables/Operation/RFQs/View/useRFQViewContext'

defineOptions({ name: 'RFQsViewTerms', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Commercial Terms' }
})

const { evaluate, ui } = useRFQViewContext()
const { terms, pending } = useRFQView()

const finalTitle = computed(() => evaluate(props.title))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
