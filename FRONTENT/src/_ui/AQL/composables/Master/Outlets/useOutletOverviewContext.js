import { ref, computed, inject } from 'vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useResourceReload } from 'src/composables/resources/useResourceReload'
import { listSearchText } from 'src/composables/resources/listViews/listViewSettings'
import { useOutletIndex } from 'src/_resource/Master/Outlets/composables/useOutletIndex'
import {
  ACTIVITY_WINDOW_DAYS,
  activityColor,
  activityLabel
} from 'src/_resource/Master/Outlets/composables/useOutletActivity'

const text = (value) => (value == null ? '' : String(value).trim())

const SOURCE_RESOURCES = [
  // The page's OWN resource. Needed because `operation-hub` is a `resource` sub-route, which
  // `usePageResolver` does not auto-load (see the docblock above).
  'Outlets',
  'OutletOperatingRules',
  'OutletVisits',
  'OutletRestocks',
  'OutletConsumptions',
  'OutletConsumptionInvoices',
  'OutletPayments'
]

let pendingLoad = null

let streamsLoaded = false

export function useOutletOverviewContext () {
  const ui = useAQLConfig()
  const nav = useResourceNav()
  const { reloadDependencies } = useResourceReload()

  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)

  const index = useOutletIndex()

  const loaded = ref(streamsLoaded)
  if (!streamsLoaded) {
    if (!pendingLoad) {
      pendingLoad = reloadDependencies({ resources: SOURCE_RESOURCES, showError: false })
        .finally(() => { streamsLoaded = true; pendingLoad = null })
    }
    pendingLoad.finally(() => { loaded.value = true })
  }

  const pending = computed(() => (resourceRecord?.loading?.value ?? false) || !loaded.value)

  const filterTerm = computed(() => String(resourceRecord?.filterTerm?.value ?? '').trim().toLowerCase())

  return {
    ui,
    pending,
    activityWindowDays: ACTIVITY_WINDOW_DAYS,

    // Metrics — read straight off the aggregate, never re-derived here.
    totals: index.totalsMetrics,
    geography: index.geography,
    pendings: index.pendingMetrics,
    visits: index.visitMetrics,
    activity: index.activityMetrics,
    views: index.views,

    filterTerm,

    filterOutlets: (rows) => {
      const keyword = filterTerm.value
      const list = Array.isArray(rows) ? rows : []
      if (!keyword) return list
      return list.filter((row) => listSearchText(row).includes(keyword))
    },

    activityColor,
    activityLabel,

    allowed: (map) => !!resourceConfig?.allowed?.(map),

    openOutlet: (code) => {
      const target = text(code)
      if (target) nav.goTo('view', { code: target })
    }
  }
}
