import { computed, effectScope, inject, onScopeDispose, reactive, ref, watch } from 'vue'
import { useListPipeline } from './useListPipeline'
import { useResourceNav } from '../useResourceNav'
import { useAdditionalActions } from '../useAdditionalActions'
import { findResourceConfig } from '../useResourceConfig'
import { readField } from 'src/utils/sortHelpers'

const instances = new WeakMap()
const lastSelectedByResource = new Map()
const lastPageByView = reactive(new Map())

export const useListView = () => {
  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)
  if (!resourceConfig) throw new Error('[useListView] No resource config on this page.')

  let shared = instances.get(resourceConfig)
  if (!shared) {
    const scope = effectScope(true)
    const state = scope.run(() => {
      const views = computed(() => {
        const value = resourceConfig.config.value?.ui?.listViews
        return Array.isArray(value) ? value : []
      })
      const resourceName = computed(() => resourceConfig.config.value?.name || '')
      const permittedViews = computed(() => views.value.filter(view => {
        let permission = view && typeof view === 'object' ? view.permission : null
        if (permission == null) return true
        if (typeof permission === 'string' && permission.includes(',')) {
          permission = permission.split(',').map(action => action.trim())
        }
        if (typeof permission === 'string') {
          return !!permission.trim() && resourceConfig.allowed(permission, resourceName.value) === true
        }
        if (Array.isArray(permission)) {
          return permission.every(action => typeof action === 'string' && !!action.trim()) &&
            resourceConfig.allowed(permission, resourceName.value) === true
        }
        if (typeof permission !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(permission))) return false
        const entries = Object.entries(permission).map(([resource, actions]) => [
          resource,
          typeof actions === 'string' && actions.includes(',')
            ? actions.split(',').map(action => action.trim())
            : actions
        ])
        permission = Object.fromEntries(entries)
        return entries.every(([resource, actions]) => {
          if (!resource.trim()) return false
          if (typeof actions === 'string') return !!actions.trim()
          return Array.isArray(actions) && actions.every(action => typeof action === 'string' && !!action.trim())
        }) && resourceConfig.allowed(permission, resourceName.value) === true
      }))
      const pipeline = useListPipeline({ resourceConfig, resourceRecord, views: permittedViews })
      const nav = useResourceNav()
      const { actionsFor } = useAdditionalActions(resourceName)
      const selectedName = ref('')
      const activeName = computed(() => {
        const wanted = selectedName.value || lastSelectedByResource.get(resourceName.value) || ''
        if (wanted && pipeline.lists.value.some(list => list.name === wanted)) return wanted
        const fallback = pipeline.lists.value.find(list => list.view?.default === true) ||
          pipeline.lists.value[0]
        return fallback?.name || ''
      })
      const activeList = computed(() => pipeline.lists.value.find(list => list.name === activeName.value) || null)
      const searchTerm = computed(() => String(resourceRecord?.filterTerm?.value || '').trim())
      const searchPage = ref(1)
      const pageKey = computed(() => JSON.stringify([resourceName.value, activeName.value]))
      const page = computed({
        get: () => searchTerm.value ? searchPage.value : (lastPageByView.get(pageKey.value) ?? 1),
        set: value => {
          if (!activeName.value || !Number.isInteger(value) || value < 1) return
          if (searchTerm.value) searchPage.value = value
          else lastPageByView.set(pageKey.value, value)
        }
      })
      watch([resourceName, activeName, searchTerm], () => { searchPage.value = 1 })
      const itemProps = computed(() => {
        return {
          ...(activeList.value?.itemProps ?? {}),
          emptyText: searchTerm.value ? 'No results match your search.' : 'No items found.',
          emptyIcon: searchTerm.value ? 'search_off' : 'inventory_2',
          emptyIconColor: 'grey-4'
        }
      })
      const actionProps = computed(() => activeList.value?.actionProps ?? {})
      const onRowClick = (item) => {
        const targetState = activeList.value?.targetState
        if (!targetState || targetState.status !== 'ready') return
        try {
          let target
          if (targetState.hasTarget) {
            target = typeof targetState.value === 'function' ? targetState.value(item) : targetState.value
          } else {
            const actionProps = activeList.value?.actionProps ?? {}
            const actions = activeList.value?.view?.actions === false ? [] : actionsFor(item, {
              only: actionProps.only,
              exclude: actionProps.exclude,
              max: actionProps.max
            })
            target = actions.length ? false : true
          }
          if (target === false) return
          const objectTarget = target !== null && typeof target === 'object' && !Array.isArray(target) &&
            [Object.prototype, null].includes(Object.getPrototypeOf(target))
          if (target !== true && typeof target !== 'string' && !objectTarget) {
            throw new TypeError('Target must be a boolean, action name, or target object.')
          }
          if (objectTarget && Object.keys(target).some(key => !['resource', 'action', 'code', 'query'].includes(key))) {
            throw new TypeError('Target object accepts only resource, action, code, and query.')
          }
          if (objectTarget && ((target.resource !== undefined &&
            (typeof target.resource !== 'string' || !target.resource.trim())) ||
            (target.code !== undefined && (typeof target.code !== 'string' || !target.code.trim())))) {
            throw new TypeError('Target resource and code must be non-empty strings.')
          }
          if (objectTarget && target.query !== undefined) {
            const query = target.query
            if (query === null || typeof query !== 'object' || Array.isArray(query) ||
              ![Object.prototype, null].includes(Object.getPrototypeOf(query))) {
              throw new TypeError('Target query must be a plain object.')
            }
            if (Object.entries(query).some(([name, path]) => !name.trim() || typeof path !== 'string' || !path.trim())) {
              throw new TypeError('Target query names and row field paths must be non-empty strings.')
            }
          }
          const action = target === true ? 'view' : objectTarget ? (target.action ?? 'index') : target
          if (typeof action !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(action)) {
            throw new TypeError('Target action must be a non-empty action name.')
          }
          const kind = action.toLowerCase()
          const needsCode = kind !== 'index' && kind !== 'add'
          const code = needsCode ? (objectTarget ? (target.code ? readField(item, target.code) : null) : item?.Code) : null
          if (needsCode && (typeof code !== 'string' || !code.trim())) return
          const destination = objectTarget && target.resource ? findResourceConfig(target.resource) : resourceConfig.config.value
          if (!destination?.name) return
          const permission = kind === 'index' || kind === 'view' ? 'read' :
            kind === 'add' ? 'write' : kind === 'edit' ? 'update' : action
          const sameResource = destination.name === resourceName.value
          const record = needsCode ? (sameResource && item?.Code === code ? item : code) : undefined
          if (!resourceConfig.allowed(permission, destination.name, record)) return
          const params = needsCode ? { code } : {}
          if (objectTarget && target.query !== undefined) {
            params.query = Object.fromEntries(Object.entries(target.query)
              .map(([name, path]) => [name, readField(item, path)])
              .filter(([, value]) => value != null && (typeof value === 'string' || typeof value === 'boolean' ||
                (typeof value === 'number' && Number.isFinite(value)))))
          }
          if (!sameResource) {
            const scope = String(destination.scope || '').toLowerCase()
            const menus = Array.isArray(destination.ui?.menus) ? destination.ui.menus : []
            const route = menus.map(menu => String(menu?.route || '').match(/^\/(master|operation|accounts)\/([^/?#]+)(?:\/|$)/i))
              .find(match => match && match[1].toLowerCase() === scope)
            if (!route) throw new Error(`Target resource "${destination.name}" has no usable menu route.`)
            params.scope = scope
            params.resourceSlug = route[2]
          }
          if (['index', 'view', 'add', 'edit'].includes(kind)) {
            nav.goTo(kind, params)
          } else {
            nav.goTo('action', { ...params, action })
          }
        } catch (error) {
          console.error(`[ListViews] Target for "${activeList.value?.name || ''}" failed:`, error)
        }
      }
      const tabs = computed(() => {
        return pipeline.lists.value.map(list => {
          const view = list.view && typeof list.view === 'object' ? list.view : {}
          const mode = view.count === true || view.count === false ? view.count : 'auto'
          const label = view.label || list.name
          const icon = view.icon || null
          const color = view.color || 'primary'
          return {
            item: { name: list.name, label, icon, color },
            active: list.name === activeName.value,
            label,
            icon,
            color,
            count: list.count,
            showCount: mode === 'auto' ? !!searchTerm.value : mode === true
          }
        })
      })
      const setActiveView = name => {
        const next = String(name || '')
        if (next && !pipeline.lists.value.some(list => list.name === next)) return
        selectedName.value = next
        if (next) lastSelectedByResource.set(resourceName.value, next)
      }
      return {
        ...pipeline, tabs, activeName, activeList, setActiveView,
        resourceName, page, itemProps, actionProps, onRowClick
      }
    })
    shared = { scope, state, users: 0 }
    instances.set(resourceConfig, shared)
  }

  shared.users++
  onScopeDispose(() => {
    if (--shared.users) return
    shared.scope.stop()
    instances.delete(resourceConfig)
  })

  return shared.state
}
