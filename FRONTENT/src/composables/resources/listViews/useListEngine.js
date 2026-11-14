import { ref, shallowRef, computed, watch, toValue, onScopeDispose, getCurrentScope } from 'vue'
import { useListResolver } from './useListResolver'
import { findResourceConfig } from 'src/composables/resources/useResourceConfig'

const defaultViteModules = import.meta.env
  ? import.meta.glob('../../../_resource/*/*/Data/{useData,useList}.js')
  : {}

const cleanKey = (str) => String(str || '').replace(/[-_\s]+/g, '').toLowerCase()

function normalizeScopeInput (scopeInput) {
  if (scopeInput == null) return ''
  return String(scopeInput).trim()
}

function buildDataModuleRegistry (moduleMap) {
  const registry = new Map()
  if (!moduleMap || typeof moduleMap !== 'object') return registry

  for (const path of Object.keys(moduleMap)) {
    const match = path.match(/(?:^|\/)_resource\/([^/]+)\/([^/]+)\/Data\/(useData|useList)\.js$/i)
    if (!match) continue
    const [, rawScope, rawResource, rawFile] = match
    const scopeKey = cleanKey(rawScope)
    const resourceKey = cleanKey(rawResource)
    const fileKey = cleanKey(rawFile)

    registry.set(`${scopeKey}::${resourceKey}::${fileKey}`, moduleMap[path])
  }
  return registry
}

function findScopesForResource (registry, resource) {
  if (!resource || !registry) return []
  const resKey = cleanKey(resource)
  const scopes = new Set()

  for (const key of registry.keys()) {
    const parts = key.split('::')
    if (parts.length === 3 && parts[1] === resKey) {
      if (parts[2] === 'usedata' || parts[2] === 'uselist') {
        scopes.add(parts[0])
      }
    }
  }

  return Array.from(scopes).sort()
}

function resolveScopeFromConfig (resourceName) {
  try {
    const cfg = findResourceConfig(resourceName)
    if (cfg?.scope) return cfg.scope
  } catch {}
  return ''
}

function resolveResourceScope (registry, scopeInput, resourceName) {
  if (!resourceName) return { scope: '', error: null }

  const explicit = normalizeScopeInput(scopeInput)
  if (explicit) {
    return { scope: cleanKey(explicit), error: null }
  }

  const configScope = normalizeScopeInput(resolveScopeFromConfig(resourceName))
  if (configScope) {
    return { scope: cleanKey(configScope), error: null }
  }

  const matchingScopes = findScopesForResource(registry, resourceName)

  if (matchingScopes.length === 0) {
    return { scope: '', error: null }
  }

  if (matchingScopes.length === 1) {
    return { scope: matchingScopes[0], error: null }
  }

  return {
    scope: '',
    error: new Error(
      `[useListEngine] Ambiguous resource "${resourceName}" matches multiple scopes (${matchingScopes.join(', ')}). ` +
      'Specify scope explicitly.'
    )
  }
}

function findLoaderInRegistry (registry, scope, resource, fileKey) {
  if (!resource || !registry || !scope) return null
  const exactKey = `${cleanKey(scope)}::${cleanKey(resource)}::${cleanKey(fileKey)}`
  return registry.get(exactKey) || null
}

async function loadModule (loaderOrModule) {
  if (typeof loaderOrModule === 'function') {
    return await loaderOrModule()
  }
  return loaderOrModule
}

export function useListEngine ({ scope, resource, listName = '', moduleLoaderMap, overrideFor }) {
  const registry = buildDataModuleRegistry(moduleLoaderMap || defaultViteModules)

  let isDisposed = false
  if (getCurrentScope()) {
    onScopeDispose(() => {
      isDisposed = true
    })
  }

  const committedScopeInput = shallowRef(null)
  const committedResource = shallowRef(null)
  const committedProvider = shallowRef(null)
  const committedRules = shallowRef(null)

  const loading = ref(false)
  const discoveryError = shallowRef(null)

  let activeToken = 0

  const resolvedResource = computed(() => toValue(resource))
  const resolvedScope = computed(() => {
    const raw = toValue(scope)
    const norm = normalizeScopeInput(raw)
    return norm || normalizeScopeInput(resolveScopeFromConfig(resolvedResource.value))
  })
  const resolvedListName = computed(() => toValue(listName))

  watch(
    [resolvedScope, resolvedResource],
    async ([scopeVal, resourceVal]) => {
      const token = ++activeToken
      discoveryError.value = null

      if (!resourceVal) {
        committedScopeInput.value = scopeVal || ''
        committedResource.value = ''
        committedProvider.value = null
        committedRules.value = null
        loading.value = false
        return
      }

      const scopeResult = resolveResourceScope(registry, scopeVal, resourceVal)
      if (scopeResult.error) {
        discoveryError.value = scopeResult.error
        committedScopeInput.value = scopeVal || ''
        committedResource.value = resourceVal
        committedProvider.value = null
        committedRules.value = null
        loading.value = false
        return
      }

      const effectiveScope = scopeResult.scope
      const dataLoader = findLoaderInRegistry(registry, effectiveScope, resourceVal, 'usedata')
      const listLoader = findLoaderInRegistry(registry, effectiveScope, resourceVal, 'uselist')

      if (!dataLoader && !listLoader) {
        committedScopeInput.value = scopeVal || ''
        committedResource.value = resourceVal
        committedProvider.value = null
        committedRules.value = null
        loading.value = false
        return
      }

      loading.value = true

      try {
        let prov = null
        let rls = null

        if (dataLoader) {
          const mod = await loadModule(dataLoader)
          if (isDisposed || token !== activeToken) return
          if (!mod || typeof mod !== 'object' || !Object.prototype.hasOwnProperty.call(mod, 'default')) {
            throw new Error(
              `[useListEngine] Data/useData.js on resource "${resourceVal}" must have an own default export`
            )
          }
          const exported = mod.default
          if (typeof exported !== 'function') {
            throw new Error(
              `[useListEngine] Data/useData.js on resource "${resourceVal}" default export must be a function, ` +
              `got ${typeof exported}`
            )
          }
          prov = exported
        }

        if (listLoader) {
          const mod = await loadModule(listLoader)
          if (isDisposed || token !== activeToken) return
          if (!mod || typeof mod !== 'object' || !Object.prototype.hasOwnProperty.call(mod, 'default')) {
            throw new Error(
              `[useListEngine] Data/useList.js on resource "${resourceVal}" must have an own default export`
            )
          }
          const exported = mod.default
          if (!exported || typeof exported !== 'object' || Array.isArray(exported)) {
            const kind = Array.isArray(exported) ? 'array' : (exported === null ? 'null' : typeof exported)
            throw new Error(
              `[useListEngine] Data/useList.js on resource "${resourceVal}" default export must be an object, got ${kind}`
            )
          }
          for (const [key, val] of Object.entries(exported)) {
            if (typeof val !== 'function') {
              throw new Error(
                `[useListEngine] Data/useList.js on resource "${resourceVal}" rule "${key}" must be a function, ` +
                `got ${typeof val}`
              )
            }
          }
          rls = exported
        }

        if (isDisposed || token !== activeToken) return

        committedScopeInput.value = scopeVal || ''
        committedResource.value = resourceVal
        committedProvider.value = prov
        committedRules.value = rls
        loading.value = false
      } catch (err) {
        if (isDisposed || token !== activeToken) return
        discoveryError.value = err instanceof Error ? err : new Error(String(err))
        committedScopeInput.value = scopeVal || ''
        committedResource.value = resourceVal
        committedProvider.value = null
        committedRules.value = null
        loading.value = false
      }
    },
    { immediate: true }
  )

  const resolver = useListResolver({
    resource: committedResource,
    listName: resolvedListName,
    provider: committedProvider,
    rules: committedRules,
    overrideFor
  })

  const resolveRows = (name) => {
    if (isDisposed) {
      return { rows: [], preparedRows: [], error: null, rule: null }
    }
    const currentRes = cleanKey(resolvedResource.value)
    const committedRes = cleanKey(committedResource.value)
    const currentScp = cleanKey(resolvedScope.value)
    const committedScp = cleanKey(committedScopeInput.value)

    if (loading.value || currentRes !== committedRes || currentScp !== committedScp) {
      return { rows: [], preparedRows: [], error: null, rule: null }
    }
    if (discoveryError.value) {
      return { rows: [], preparedRows: [], error: discoveryError.value, rule: null }
    }
    return resolver.resolveRows(name)
  }

  return { loading, resolveRows }
}
