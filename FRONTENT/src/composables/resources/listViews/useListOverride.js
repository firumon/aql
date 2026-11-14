import { reactive, toValue, watch } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'

const DEFAULT_KIND = 'Data'

const rawModules = import.meta.glob('../../../_ui/**/components/**/list*.js')

const overrideRegistry = {}
Object.keys(rawModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\/\.\.\//, '').toLowerCase()
  overrideRegistry[key] = rawModules[rawPath]
})

const loadCache = new Map()

function findOverrideLoader (ctx, listName, kind) {
  const uiKey = String(toValue(ctx.uiName) || '').trim().toLowerCase()
  const scopeKey = String(toValue(ctx.scope) || '').trim().toLowerCase()
  const resourceKey = toPascalCase(String(toValue(ctx.resource) || '').trim()).toLowerCase()
  const pageKey = String(toValue(ctx.page) || '').trim().toLowerCase()
  const listKey = toPascalCase(String(listName || '').trim()).toLowerCase()
  const kindKey = toPascalCase(String(kind || DEFAULT_KIND).trim()).toLowerCase()
  if (!uiKey || !scopeKey || !resourceKey || !pageKey || !listKey || !kindKey) return null
  const paths = [
    `_ui/${uiKey}/components/${scopeKey}/${resourceKey}/${pageKey}/list${listKey}${kindKey}.js`,
    `_ui/${uiKey}/components/${scopeKey}/${resourceKey}/list${listKey}${kindKey}.js`
  ]
  for (const path of paths) {
    const loader = overrideRegistry[path]
    if (loader) return loader
  }
  return null
}

export function useListOverrides (ctx) {
  const stateByName = reactive({})

  function overrideFor (listName, kind = DEFAULT_KIND) {
    const keyed = `${String(listName == null ? '' : listName).trim()}::${String(kind || DEFAULT_KIND).trim().toLowerCase()}`
    const listKey = keyed.split('::')[0]
    if (!listKey) return null
    let state = stateByName[keyed]
    if (!state) {
      const loader = findOverrideLoader(ctx, listKey, keyed.split('::')[1])
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
      stateByName[keyed] = state
    }
    return state
  }

  watch(() => [toValue(ctx.uiName), toValue(ctx.scope), toValue(ctx.resource), toValue(ctx.page)].join('::'), () => {
    for (const key of Object.keys(stateByName)) delete stateByName[key]
  })

  return { overrideFor }
}
