<template>
  <div class="list-switcher">
    <div ref="rowRef" class="list-switcher__tabs">
      <ListSwitcherItem
        v-for="tab in tabs"
        :key="tab.item.name"
        v-bind="tab"
        :data-name="tab.item.name"
        :class="hiddenNames.includes(tab.item.name) ? 'aql-list-switcher-item--hidden' : ''"
        @click="setActiveView(tab.item.name)"
      />

      <button
        v-if="!isDrag && hiddenNames.length"
        ref="moreRef"
        class="aql-list-switcher-item aql-list-switcher-item--more"
        :class="moreClasses"
        :style="moreStyle"
      >
        <q-icon :name="moreIcon" class="aql-list-switcher-item__icon" />
        <span class="aql-list-switcher-item__label">{{ moreLabel }}</span>
        <span
          v-if="activeHidden && activeHidden.showCount && activeHidden.count != null"
          class="aql-list-switcher-item__count"
        >
          {{ activeHidden.count }}
        </span>
        <q-icon name="arrow_drop_down" class="q-ml-xs" size="16px" />
        <span v-if="activeHidden" class="aql-list-switcher-item__dot" />
        <q-menu auto-close transition-show="jump-down" transition-hide="jump-up">
          <q-list style="min-width: 140px; padding: 4px 0;">
            <q-item
              v-for="tab in moreTabs"
              :key="tab.item.name"
              clickable
              :active="tab.active"
              active-class="text-weight-bold"
              :class="tab.active ? 'bg-grey-2' : ''"
              :style="tab.active ? { color: resolveCssColor(tab.color) } : {}"
              @click="setActiveView(tab.item.name)"
            >
              <q-item-section v-if="tab.icon" avatar style="min-width: auto; padding-right: 8px;">
                <q-icon :name="tab.icon" size="18px" />
              </q-item-section>
              <q-item-section>{{ tab.label }}</q-item-section>
              <q-item-section v-if="tab.showCount && tab.count != null" side>
                <q-badge color="grey-4" text-color="grey-9" rounded>
                  {{ tab.count }}
                </q-badge>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useListView } from 'src/composables/resources/listViews/useListView'
import { useTabFit } from 'src/composables/resources/listViews/useTabFit'
import ListSwitcherItem from 'components/sections/ListSwitcherItem.vue'
import { resolveCssColor } from 'src/utils/colorHelpers'

defineOptions({ name: 'SectionsListSwitcher', inheritAttrs: false })

const { tabs, setActiveView } = useListView()

const rowRef = ref(null)
const moreRef = ref(null)
const { isDrag, hiddenNames } = useTabFit({ tabs, rowRef, moreRef })

const moreTabs = computed(() =>
  tabs.value.filter(tab => hiddenNames.value.includes(tab.item.name)))
const activeHidden = computed(() =>
  tabs.value.find(tab => tab.active && hiddenNames.value.includes(tab.item.name)) || null)
const moreLabel = computed(() => activeHidden.value?.label || 'More')
const moreIcon = computed(() => activeHidden.value?.icon || 'more_horiz')
const moreClasses = computed(() => activeHidden.value
  ? { 'aql-list-switcher-item--active': true }
  : { 'aql-list-switcher-item--inactive': true })
const moreStyle = computed(() => activeHidden.value
  ? { '--aql-switcher-color': resolveCssColor(activeHidden.value.color) }
  : {})
</script>
