import { unref } from 'vue'
import { readField } from 'src/utils/sortHelpers'
import { decorateRow, singularize } from 'src/utils/appHelpers'

const KIND = 'Search'

const columnsOf = (view, listName) => {
  const raw = view?.search
  if (raw == null || raw === false || raw === '') return null
  const columns = (Array.isArray(raw) ? raw : String(raw).split(','))
    .map(column => String(column || '').trim())
    .filter(Boolean)
  if (!columns.length) {
    throw new TypeError(`[feature/${KIND}] List "${listName}": search needs at least one column.`)
  }
  for (const column of columns) readField(null, column)
  return columns
}

const isDefaultColumn = key => {
  if (typeof key !== 'string' || !key) return false
  if (key.charAt(0) === '_' || key.charAt(0) === '$') return false
  const upper = key.toUpperCase()
  if (upper.endsWith('AT')) return false
  return upper.endsWith('NAME') || upper.endsWith('CODE') || upper.endsWith('DATE') ||
    upper.startsWith('PROGRESS') || upper.endsWith('COMMENT') || upper.includes('REMARK')
}

const parentColumnsOf = (sample, masterSet) => {
  const meta = sample._relation
  if (!meta || typeof meta !== 'object') return []
  const found = new Set()
  const add = (resource, keys) => {
    for (const key of keys) {
      if (!key || key === '$' || !masterSet.has(resource)) continue
      const value = readField(sample, key)
      const parent = Array.isArray(value)
        ? value.find(item => item && typeof item === 'object')
        : value
      if (!parent || typeof parent !== 'object') continue
      for (const header of Object.keys(parent)) {
        if (isDefaultColumn(header)) found.add(key + '.' + header)
      }
    }
  }
  for (const parent of meta.parents || []) {
    add(parent.resourceName, [
      '$' + String(parent.singular || '').toLowerCase(),
      '$' + String(parent.resourceName || '').toLowerCase()
    ])
  }
  for (const ref of Object.values(meta.refs || {})) {
    add(ref.resource, [
      '$' + singularize(String(ref.resource || '')).toLowerCase(),
      '$' + String(ref.resource || '').toLowerCase()
    ])
  }
  return [...found]
}

const defaultColumnsOf = (records, config) => {
  const sample = records.find(row => row && typeof row === 'object' && !Array.isArray(row))
  if (!sample) return []
  const columns = Object.keys(sample).filter(isDefaultColumn)
  return [...columns, ...parentColumnsOf(sample, config?.masterResources)]
}

const searchTermOf = (row, columns) => columns.map(column => {
  const value = readField(row, column)
  if (value == null) return ''
  return Array.isArray(value)
    ? value.flat(Infinity).map(item => item == null ? '' : String(item)).join(' ')
    : String(value)
}).join(' ').toLowerCase()

export default function searchFeature (records, config) {
  if (!Array.isArray(records)) {
    throw new TypeError(`[feature/${KIND}] records must be an array, got ${typeof records}`)
  }
  const view = config?.view || null
  const listName = String(config?.listName || '')
  const overrideState = config?.overrideFor ? config.overrideFor(listName, KIND) : null
  const explicit = columnsOf(view, listName)
  const hasOverride = !!overrideState && overrideState.status !== 'none'
  const columns = explicit || (hasOverride ? null : defaultColumnsOf(records, config))
  if (overrideState?.status === 'error') {
    throw overrideState.error || new Error(`[feature/${KIND}] list${listName}${KIND}.js failed to load.`)
  }
  if (!columns) return records

  const rows = records.map(row => {
    const source = (row && typeof row === 'object') ? row : {}
    return decorateRow(source, { _search_filter_term: searchTermOf(source, columns) })
  })
  const term = String(config?.term ?? '').trim().toLowerCase()
  const coreRows = term
    ? rows.filter(row => row._search_filter_term.includes(term))
    : rows

  if (overrideState?.status !== 'ready') return coreRows
  if (typeof overrideState.module !== 'function') {
    throw new TypeError(`[feature/${KIND}] list${listName}${KIND}.js must export a function, got ${typeof overrideState.module}`)
  }
  const out = unref(overrideState.module(coreRows, records, view))
  if (!Array.isArray(out)) {
    throw new TypeError(`[feature/${KIND}] list${listName}${KIND}.js must return an array, got ${typeof out}`)
  }
  return out
}
