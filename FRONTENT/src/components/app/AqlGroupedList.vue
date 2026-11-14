<template>
  <q-list>
    <q-card v-if="loading" flat bordered>
      <q-card-section class="flex flex-center q-pa-xl">
        <q-spinner color="primary" size="3em" />
      </q-card-section>
    </q-card>

    <slot v-else-if="!groupedItems.length" name="empty">
      <q-card flat bordered :class="cardClass">
        <q-card-section class="q-pa-none">
          <q-item class="text-center q-py-xl">
            <q-item-section>
              <q-icon :name="emptyIcon" size="48px" color="grey-4" class="q-mb-sm block q-mx-auto" />
              <q-item-label class="text-subtitle1 text-weight-bold text-grey-6">{{ emptyText }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-card-section>
      </q-card>
    </slot>

    <q-card v-for="(group, groupIndex) in groupedItems" :key="resolveGroupKey(group, groupIndex)" flat bordered :class="[cardClass, gutterClass]">
      <slot name="header" :group="group" :index="groupIndex">
        <q-item :class="headerClass">
          <q-item-section v-if="hasHeaderIcon(group) || slots['header-icon']" side>
            <slot name="header-icon" :group="group" :index="groupIndex">
              <q-icon :name="group.icon" :color="resolveProp(headerIconColor, group)" :size="headerIconSize" />
            </slot>
          </q-item-section>

          <q-item-section>
            <q-item-label :class="headerLabelClass">{{ group.label }}</q-item-label>
            <q-item-label v-if="resolveProp(headerCaption, group)" caption :class="headerCaptionClass">
              {{ resolveProp(headerCaption, group) }}
            </q-item-label>
          </q-item-section>

          <q-item-section v-if="hasHeaderRight(group) || slots['header-right']" side>
            <slot name="header-right" :group="group" :index="groupIndex">
              <q-chip v-if="useHeaderChip" size="sm" class="text-weight-bold" style="font-size: 0.75rem"
                :color="resolveProp(headerChipColor, group)" :text-color="resolveProp(headerChipTextColor, group)"
                :outline="headerChipOutline">{{ group.headerRight }}</q-chip>
              <q-badge v-else :color="resolveProp(headerBadgeColor, group)" :text-color="resolveProp(headerBadgeTextColor, group)"
                :outline="headerBadgeOutline" :label="group.headerRight" />
            </slot>
          </q-item-section>
        </q-item>
      </slot>

      <q-separator />

        <q-card-section class="q-pa-none aql-grouped-list-body">
        <AppList v-bind="appListAttrs" :items="group.items">
          <template v-for="(_, slotName) in $slots" :key="slotName" #[slotName]="slotData">
            <slot :name="slotName" v-bind="slotData || {}" />
          </template>
        </AppList>
      </q-card-section>
    </q-card>
  </q-list>
</template>

<script setup>
import { computed, useSlots, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'

defineOptions({ name: 'AqlGroupedList', inheritAttrs: false })

const props = defineProps({
  items: { type: Array, default: () => [], required: true },
  groups: { type: Array, default: undefined },
  groupKey: { type: [String, Function], required: true },
  groupLabel: { type: [String, Function], default: null },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: 'No records found.' },
  emptyIcon: { type: String, default: 'inventory_2' },

  cardClass: { type: [String, Array, Object], default: '' },

  gutter: { type: [String, Boolean], default: 'sm' },

  itemGutter: { type: [String, Boolean], default: null },

  headerClass: { type: [String, Array, Object], default: 'bg-grey-2 q-py-xs q-px-sm' },
  headerLabel: { type: [String, Function], required: false },
  headerLabelClass: { type: [String, Array, Object], default: 'text-caption text-weight-bold text-grey-9' },
  headerCaption: { type: [String, Function], default: null },
  headerCaptionClass: { type: [String, Array, Object], default: 'text-grey-6' },
  headerIcon: { type: [String, Function], default: null },
  headerIconColor: { type: [String, Function], default: 'primary' },
  headerIconSize: { type: String, default: 'xs' },
  headerBadge: { type: [String, Number, Function], default: null },
  headerBadgeColor: { type: [String, Function], default: 'primary' },
  headerBadgeTextColor: { type: [String, Function], default: 'white' },
  headerBadgeOutline: { type: Boolean, default: true },
  headerChip: { type: [String, Number, Function], default: null },
  headerChipColor: { type: [String, Function], default: 'primary' },
  headerChipTextColor: { type: [String, Function], default: 'white' },
  headerChipOutline: { type: Boolean, default: false },
})

const slots = useSlots()
const attrs = useAttrs()

// `q-mb-none` is not a real Quasar class, so "no gutter" has to resolve to no
// class at all rather than to a token that silently does nothing.
const gutterClass = computed(() => {
  const token = props.gutter
  if (token === false || token === '' || token === 'none' || token == null) return null
  return `q-mb-${token}`
})

// Forward the page gutter to the rows.
const appListAttrs = computed(() => ({
  itemBordered: false, dense: true, separator: true,
  ...attrs,
  gutter: props.itemGutter ?? props.gutter
}))

const groupedItems = computed(() => {
  const groups = new Map()
  if (props.groups === undefined) props.items.forEach(item => {
    const key = resolveProp(props.groupKey, item, 'Ungrouped')
    const normalizedKey = key || 'Ungrouped'
    if (!groups.has(normalizedKey)) {
      groups.set(normalizedKey, {
        key: normalizedKey,
        icon: resolveProp(props.headerIcon, item),
        firstItem: item,
        items: []
      })
    }
    groups.get(normalizedKey).items.push(item)
  })
  return (props.groups ?? Array.from(groups.values())).map(group => ({
    icon: resolveProp(props.headerIcon, group.firstItem),
    ...group,
    label: resolveGroupLabel(group),
    headerRight: resolveProp(props.headerChip || props.headerBadge, group)
  }))
})

// A label FUNCTION gets the whole group, like `headerCaption` and `headerChip` do — it is a
// header prop and must see `group.items`. A string key still reads off the first row.
function resolveGroupLabel (group) {
  const prop = props.groupLabel || props.headerLabel
  if (typeof prop === 'function') return prop(group)
  if (prop) return resolveProp(prop, group.firstItem, group.key)

  return resolveProp(props.groupKey, group.firstItem, group.key)
}

function resolveProp(prop, source, fallback = '') {
  if (prop === null || prop === undefined || prop === '') return fallback
  if (typeof prop === 'function') return prop(source)
  return (source && typeof source === 'object' && prop in source) ? source[prop] : prop
}

function resolveGroupKey(group, index) {
  return group.key || index
}

function hasHeaderIcon(group) {
  return !!resolveProp(props.headerIcon, group)
}

function hasHeaderRight(group) {
  return !!(
    resolveProp(props.headerChip, group) ||
    resolveProp(props.headerBadge, group)
  )
}

const useHeaderChip = computed(() => {
  return props.headerChip !== null && props.headerChip !== undefined
})
</script>
