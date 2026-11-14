import { computed, readonly } from 'vue'
import { decorateRow } from 'src/utils/appHelpers'
import { useListEngine } from './useListEngine'
import { useListOverrides } from './useListOverride'
import { useTokenOverrides } from './useTokenOverride'
import { runFeatures } from './useFeatureChain'
import { resolveTokenContext } from 'src/utils/tokenEvaluator'
import { useAuthStore } from 'src/stores/auth'

export const useListPipeline = ({ resourceConfig, resourceRecord, views }) => {
  const context = {
    uiName: () => resourceConfig.customUIName?.value || '',
    scope: () => resourceConfig.scope?.value || '',
    resource: () => resourceConfig.config.value?.name || '',
    page: () => 'Index'
  }
  const authStore = useAuthStore()
  const { overrideFor } = useListOverrides(context)
  const { tokenFor } = useTokenOverrides(context)
  const engine = useListEngine(decorateRow(context, {
    moduleLoaderMap: resourceConfig.moduleLoaderMap, overrideFor
  }))

  const results = computed(() => views.value.flatMap(savedView => {
    const name = typeof savedView === 'string' ? savedView : savedView?.name
    if (!name) return []
    const source = computed(() => engine.resolveRows(name))
    return computed(() => {
      let view = savedView
      try {
        const ctx = resolveTokenContext()
        const state = overrideFor(name, 'Config')
        const file = `list${name}Config.js`
        if (state?.status === 'error') {
          throw new Error(`[ListViews/Config] ${file} failed to load. ${state.error?.message || state.error || ''}`)
        }
        if (state?.status === 'ready') {
          const base = typeof savedView === 'object' ? savedView : { name }
          let patch
          try {
            patch = typeof state.module === 'function' ? state.module(readonly({
              listName: name, view: base, user: ctx.user,
              resourceName: context.resource(), term: resourceRecord?.filterTerm?.value || ''
            })) : state.module
          } catch (cause) {
            throw new Error(`[ListViews/Config] ${file} failed.`, { cause })
          }
          if (!patch || typeof patch !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(patch))) {
            throw new TypeError(`[ListViews/Config] ${file} must return or export a plain config object.`)
          }
          if ('name' in patch || 'permission' in patch) {
            throw new TypeError(`[ListViews/Config] ${file} cannot change name or permission.`)
          }
          view = readonly(decorateRow(base, patch))
        }
        if (source.value.error) throw source.value.error
        const output = { itemProps: {}, actionProps: {}, targetState: { status: 'loading', value: null } }
        const rows = runFeatures(source.value.rows, decorateRow(output, {
          view: typeof view === 'object' ? view : null,
          listName: name,
          overrideFor,
          tokenFor,
          ctx,
          term: resourceRecord?.filterTerm?.value || '',
          masterResources: new Set((authStore.resources || [])
            .filter(item => String(item?.scope || '').toLowerCase() === 'master')
            .map(item => item.name))
        }))
        return decorateRow({ name, view, rows, count: rows.length, error: null }, output)
      } catch (error) {
        return { name, view, rows: [], itemProps: {}, actionProps: {}, targetState: null, count: 0, error }
      }
    })
  }))

  const lists = computed(() => results.value.map(result => result.value))
  const loading = computed(() => engine.loading.value || resourceRecord?.loading?.value || false)

  return { lists, loading }
}
