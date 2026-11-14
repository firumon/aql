import { reactive, toValue, watch } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'

const rawModules = import.meta.glob('../../../_ui/**/composables/**/token*.js')

const tokenRegistry = {}
Object.keys(rawModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\/\.\.\//, '').toLowerCase()
  tokenRegistry[key] = rawModules[rawPath]
})

const loadCache = new Map()

function findTokenLoader (ctx, name) {
  const uiKey = String(toValue(ctx.uiName) || '').trim().toLowerCase()
  const tokenKey = toPascalCase(String(name || '').trim()).toLowerCase()
  if (!uiKey || !tokenKey) return null
  const scopeKey = String(toValue(ctx.scope) || '').trim().toLowerCase()
  const resourceKey = toPascalCase(String(toValue(ctx.resource) || '').trim()).toLowerCase()
  const paths = [
    `_ui/${uiKey}/composables/${scopeKey}/${resourceKey}/token${tokenKey}.js`,
    `_ui/${uiKey}/composables/token${tokenKey}.js`
  ]
  for (const path of paths) {
    const loader = tokenRegistry[path]
    if (loader) return loader
  }
  return null
}

export function useTokenOverrides (ctx) {
  const stateByName = reactive({})

  function tokenFor (name) {
    const clean = toPascalCase(String(name || '').trim())
    if (!clean) return null
    let state = stateByName[clean]
    if (!state) {
      const loader = findTokenLoader(ctx, clean)
      if (!loader) {
        state = { status: 'none' }
      } else {
        state = reactive({ status: 'loading', module: null, error: null })
        if (!loadCache.has(loader)) {
          loadCache.set(loader, loader().then((mod) => mod.default))
        }
        loadCache.get(loader).then((mod) => {
          Object.assign(state, { status: 'ready', module: mod })
        }).catch((err) => {
          state.status = 'error'
          state.error = err
        })
      }
      stateByName[clean] = state
    }
    return state
  }

  watch(() => [toValue(ctx.uiName), toValue(ctx.scope), toValue(ctx.resource)].join('::'), () => {
    for (const key of Object.keys(stateByName)) delete stateByName[key]
  })

  return { tokenFor }
}
