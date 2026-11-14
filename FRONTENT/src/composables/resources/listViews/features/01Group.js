import { unref } from 'vue'
import { readField, sortValue, compareValues, valueType } from 'src/utils/sortHelpers'
import { decorateRow } from 'src/utils/appHelpers'
import { tokenizeValue } from 'src/utils/tokenEvaluator'

const KIND = 'Group'
const AGGREGATES = ['sum', 'min', 'max', 'avg']

const rulesOf = (view, listName) => {
  const raw = view?.group
  if (raw == null || raw === false) return null
  if (!Array.isArray(raw)) {
    throw new TypeError(`[feature/${KIND}] List "${listName}": group must be an array of rules.`)
  }
  return raw.map((rule, index) => {
    const label = `[feature/${KIND}] List "${listName}", group rule ${index + 1}`
    if (!rule || typeof rule !== 'object' || Array.isArray(rule) ||
      typeof rule.column !== 'string' || !rule.column.trim()) {
      throw new TypeError(`${label}: column is required.`)
    }
    readField(null, rule.column)
    let token = null
    if (rule.token != null && rule.token !== false && String(rule.token).trim()) {
      token = String(rule.token).trim()
    }
    let aggregates = null
    if (rule.aggregate != null) {
      if (typeof rule.aggregate !== 'object' || Array.isArray(rule.aggregate)) {
        throw new TypeError(`${label}: aggregate must be an object of column -> aggregate names.`)
      }
      aggregates = Object.entries(rule.aggregate).map(([column, aggs]) => {
        if (typeof column !== 'string' || !column.trim()) {
          throw new TypeError(`${label}: aggregate column is required.`)
        }
        readField(null, column)
        const names = (Array.isArray(aggs) ? aggs : [aggs]).map(String)
        for (const name of names) {
          if (!AGGREGATES.includes(name)) {
            throw new TypeError(`${label}: aggregate "${name}" is not one of ${AGGREGATES.join(', ')}.`)
          }
        }
        return { column, names }
      })
    }
    return { column: rule.column, token, aggregates }
  })
}

const aggregateValue = (name, items, type, label, column) => {
  if (!items.length) return name === 'sum' ? 0 : null
  if (name === 'sum' || name === 'avg') {
    if (type !== 'number') {
      throw new TypeError(`${label}: column "${column}" needs type "number" for ${name}.`)
    }
    const total = items.reduce((sum, item) => sum + item, 0)
    return name === 'avg' ? total / items.length : total
  }
  return items.reduce((best, item) => {
    const difference = compareValues(item, best)
    return (name === 'min' ? difference < 0 : difference > 0) ? item : best
  })
}

// One grouping pass: bucket `rows`, attach per-bucket facts, collapse to representatives.
const pass = (rows, rule, custom, ctx, listName) => {
  const buckets = new Map()
  const valueOf = (row) => {
    let value = readField(row, rule.column)
    if (rule.token) {
      const known = tokenizeValue(value, rule.token)
      if (known != null) return known
      if (custom) return custom(value, ctx)
    }
    return value
  }
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const value = valueOf(row)
    const key = String(value)
    if (!buckets.has(key)) buckets.set(key, { value, members: [] })
    buckets.get(key).members.push(row)
  }

  const factsByKey = new Map()
  for (const bucket of buckets.values()) {
    const base = `_group_${rule.column}_${String(bucket.value)}`
    const facts = {}
    facts[`${base}_size`] = bucket.members.length
    if (bucket.members.length) facts[`${base}_0`] = bucket.members[0]
    for (const { column, names } of rule.aggregates || []) {
      const raws = bucket.members.map(row => readField(row, column))
      const type = valueType(raws)
      const items = raws.map(value => sortValue(value, type)).filter(item => item !== null)
      for (const name of names) {
        facts[`${base}_${name}_${column}`] = aggregateValue(
          name, items, type, `[feature/${KIND}] List "${listName}", group "${base}"`, column)
      }
    }
    factsByKey.set(String(bucket.value), facts)
  }

  const reps = [...buckets.values()].map(bucket => bucket.members[0])
  return { reps, valueOf, factsByKey }
}

export default function groupFeature (records, config) {
  if (!Array.isArray(records)) {
    throw new TypeError(`[feature/${KIND}] records must be an array, got ${typeof records}`)
  }
  const view = config?.view || null
  const listName = String(config?.listName || '')
  const overrideState = config?.overrideFor ? config.overrideFor(listName, KIND) : null
  const rules = rulesOf(view, listName)
  if (overrideState?.status === 'error') {
    throw overrideState.error || new Error(`[feature/${KIND}] list${listName}${KIND}.js failed to load.`)
  }
  if (!rules?.length) {
    if (overrideState?.status !== 'ready') return records
  }

  const ctx = config?.ctx || {}
  const resolved = (rules || []).map(rule => {
    let custom = null
    if (rule.token) {
      const name = rule.token.replace(/^\$/, '').split(':')[0]
      const state = config?.tokenFor?.(name)
      if (state?.status === 'error') {
        throw state.error || new Error(`[feature/${KIND}] token${name}.js failed to load.`)
      }
      if (state?.status === 'ready') {
        if (typeof state.module !== 'function') {
          throw new TypeError(`[feature/${KIND}] token${name}.js must export a function, got ${typeof state.module}`)
        }
        custom = state.module
      }
    }
    return { rule, custom }
  })

  // Cascade: rule N buckets rule N-1's representatives. Each rule's facts are computed
  // over its own input rows (the previous rule's reps, or the full set for rule 1).
  let rows = records
  const passes = resolved.map(({ rule, custom }) => {
    const result = pass(rows, rule, custom, ctx, listName)
    rows = result.reps
    return result
  })

  // Final output: last rule's representatives; each carries its own bucket's facts from
  // every rule, looked up by its value under that rule's column.
  let coreRows = passes.length ? passes[passes.length - 1].reps : records
  coreRows = coreRows.map(rep => {
    const facts = {}
    passes.forEach(({ valueOf, factsByKey }) => {
      Object.assign(facts, factsByKey.get(String(valueOf(rep))))
    })
    return decorateRow(rep, facts)
  })

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
