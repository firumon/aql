import { computed, toValue, unref, getCurrentScope, onScopeDispose } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'

export function useListResolver ({ resource, listName, provider, rules, overrideFor }) {
  let isDisposed = false
  if (getCurrentScope()) {
    onScopeDispose(() => {
      isDisposed = true
    })
  }

  let lastProvider = null
  let lastResource = null
  let cachedPreparedRef = null
  let providerError = null

  function evaluateProvider (res, prov) {
    if (lastProvider !== prov || lastResource !== res) {
      lastProvider = prov
      lastResource = res
      cachedPreparedRef = null
      providerError = null

      if (prov == null) {
        return
      }

      if (typeof prov !== 'function') {
        providerError = new Error(`[useListResolver] Provider for resource "${res}" must be a function, got ${typeof prov}`)
        return
      }

      try {
        const result = prov()
        if (!result || typeof result !== 'object' || !('value' in result)) {
          providerError = new Error(
            `[useListResolver] Provider for resource "${res}" must return a ref or computed, got ${typeof result}`
          )
          return
        }
        cachedPreparedRef = result
      } catch (err) {
        providerError = err instanceof Error ? err : new Error(String(err))
      }
    }
  }

  function resolveRows (selectedName = toValue(listName)) {
    if (isDisposed) {
      return { rows: [], preparedRows: [], error: null, rule: null }
    }

    try {
      const res = toValue(resource)
      if (!res) {
        return { rows: [], preparedRows: [], error: null, rule: null }
      }

      const prov = unref(provider)
      evaluateProvider(res, prov)

      if (providerError) {
        return { rows: [], preparedRows: [], error: providerError, rule: null }
      }

      let base = []
      if (cachedPreparedRef) {
        const val = unref(cachedPreparedRef)
        if (!Array.isArray(val)) {
          throw new Error(`[useListResolver] Provider for resource "${res}" must resolve to an array, got ${typeof val}`)
        }
        base = val
      } else {
        const recordSource = useRecord()
        if (!recordSource || typeof recordSource.enriched !== 'function') {
          throw new Error(`[useListResolver] useRecord must expose an enriched function for resource "${res}"`)
        }
        const enriched = recordSource.enriched(res)
        const resolved = unref(enriched)
        if (!Array.isArray(resolved)) {
          const kind = resolved === null ? 'null' : typeof resolved
          throw new Error(`[useListResolver] Base rows for resource "${res}" must be an array, got ${kind}`)
        }
        base = resolved
      }

      const rawListName = toValue(selectedName)
      const ruleMap = unref(rules)

      const ovState = overrideFor ? overrideFor(rawListName) : null
      if (ovState && ovState.status === 'ready') {
        const mod = ovState.module
        if (typeof mod === 'function') {
          const out = mod(base)
          const resolved = out && typeof out === 'object' && 'value' in out ? unref(out) : out
          if (!Array.isArray(resolved)) {
            throw new Error(`[useListResolver] Override "${rawListName}" on resource "${res}" must return an array, got ${typeof resolved}`)
          }
          return { rows: resolved, preparedRows: base, error: null, rule: null }
        }
        if (Array.isArray(mod)) {
          return { rows: mod, preparedRows: base, error: null, rule: null }
        }
        return {
          rows: [],
          preparedRows: base,
          error: new Error(`[useListResolver] Override "${rawListName}" on resource "${res}" must be a function or array, got ${typeof mod}`),
          rule: null
        }
      }
      if (ovState && ovState.status === 'error') {
        return {
          rows: [], preparedRows: base, rule: null,
          error: ovState.error || new Error(`[useListResolver] Override "${rawListName}" failed to load.`)
        }
      }

      if (ruleMap != null) {
        if (typeof ruleMap !== 'object' || Array.isArray(ruleMap)) {
          const kind = Array.isArray(ruleMap) ? 'array' : typeof ruleMap
          throw new Error(`[useListResolver] Rule map on resource "${res}" must be an object, got ${kind}`)
        }

        for (const [key, val] of Object.entries(ruleMap)) {
          if (typeof val !== 'function') {
            throw new Error(`[useListResolver] Rule "${key}" on resource "${res}" must be a function, got ${typeof val}`)
          }
        }

        const name = rawListName == null ? '' : String(rawListName)

        let selectedKey = null
        if (name && Object.prototype.hasOwnProperty.call(ruleMap, name)) {
          selectedKey = name
        } else if (Object.prototype.hasOwnProperty.call(ruleMap, 'default')) {
          selectedKey = 'default'
        }

        if (selectedKey !== null) {
          const ruleFn = ruleMap[selectedKey]
          const result = ruleFn(base)
          if (!Array.isArray(result)) {
            throw new Error(
              `[useListResolver] Rule "${selectedKey}" on resource "${res}" must return an array, got ${typeof result}`
            )
          }
          return { rows: result, preparedRows: base, error: null, rule: ruleFn }
        }
      }

      return { rows: base, preparedRows: base, error: null, rule: null }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err))
      return { rows: [], preparedRows: [], error: errorObj, rule: null }
    }
  }

  const execution = computed(() => resolveRows())
  const rows = computed(() => {
    if (isDisposed) return []
    return execution.value.rows
  })
  const error = computed(() => {
    if (isDisposed) return null
    return execution.value.error
  })
  const preparedRows = computed(() => {
    if (isDisposed) return []
    return execution.value.preparedRows
  })

  return {
    rows,
    error,
    preparedRows,
    resolveRows
  }
}
