import { parseAnyDate } from 'src/utils/dateHelpers'

export function sortByDate (items, column, direction = 'asc') {
  const rows = Array.isArray(items) ? items : []
  const sign = direction === 'desc' ? -1 : 1
  const read = typeof column === 'function' ? column : (row) => row?.[column]

  return [...rows].sort((a, b) => {
    const left = parseAnyDate(read(a))
    const right = parseAnyDate(read(b))
    if (!left && !right) return 0
    if (!left) return 1
    if (!right) return -1
    return sign * (left - right)
  })
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor'])
const blank = value => value == null || (typeof value === 'string' && !value.trim()) ||
  (typeof value === 'number' && !Number.isFinite(value))
const numeric = value => ['number', 'boolean', 'string'].includes(typeof value) && Number.isFinite(Number(value))
const dateShape = /^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})(?:[T ]|$)/

export const readField = (row, path) => {
  const keys = String(path).split('.')
  if (keys.some(key => !key || unsafeKeys.has(key))) throw new Error(`[Column] Invalid column path "${path}".`)
  if (row != null && typeof row === 'object' && path in row) return row[path]

  const read = (value, index) => {
    if (value == null || index === keys.length) return value
    const key = keys[index]
    if (Array.isArray(value) && key !== 'length' && !/^\d+$/.test(key)) {
      return value.flatMap(item => {
        const result = read(item, index)
        return Array.isArray(result) ? result : [result]
      })
    }
    return read(value[key], index + 1)
  }
  return read(row, 0)
}

export const valueType = values => {
  const present = values.flat().filter(value => !blank(value))
  if (present.some(value => value instanceof Date || (typeof value === 'string' && dateShape.test(value.trim())))) return 'date'
  return present.every(numeric) ? 'number' : 'text'
}

export const sortValue = (value, type) => {
  if (blank(value)) return null
  if (typeof value === 'object' && !(value instanceof Date)) {
    throw new TypeError('[Order] Choose a field inside the object, or use aggregate "count" for a child list.')
  }
  if (type === 'text') return String(value)
  if (type === 'number') return numeric(value) ? Number(value) : null

  let input = value
  if (numeric(value)) {
    input = Number(value)
    if (type === 'unix' || (type === 'date' && Math.abs(input) >= 1e9 && Math.abs(input) < 1e11)) input *= 1000
  }
  const date = parseAnyDate(input)
  return date ? date.getTime() : null
}

export const compareValues = (a, b) => typeof a === 'string' ? collator.compare(a, b) : a - b

export const sortRecords = (records, rules) => {
  if (!rules.length) return records
  const columns = rules.map(rule => {
    const inRows = records.map(row => (rule.matches ? !!rule.matches(row) : true))
    const raw = records.map((row, index) => inRows[index] ? readField(row, rule.column) : undefined)
    const type = rule.type && rule.type !== 'auto' ? rule.type : valueType(raw)
    const values = raw.map((value, index) => {
      if (!inRows[index]) return undefined
      if (rule.aggregate === 'count') return Array.isArray(value) ? value.length : (blank(value) ? 0 : 1)
      if (!Array.isArray(value)) return sortValue(value, type)
      if (!rule.aggregate) throw new Error(`[Order] Column "${rule.column}" has many values. Choose min, max, sum, or count.`)
      const items = value.map(item => sortValue(item, type)).filter(item => item !== null)
      if (!items.length) return rule.aggregate === 'sum' ? 0 : null
      if (rule.aggregate === 'sum') {
        if (type !== 'number') throw new Error(`[Order] Column "${rule.column}" needs type "number" for sum.`)
        return items.reduce((total, item) => total + item, 0)
      }
      return items.reduce((best, item) => {
        const difference = compareValues(item, best)
        return (rule.aggregate === 'min' ? difference < 0 : difference > 0) ? item : best
      })
    })
    return { values, sign: rule.order === 'desc' ? -1 : 1 }
  })
  const lists = records.map((row, index) => {
    const out = []
    for (const column of columns) {
      if (column.values[index] !== undefined) out.push({ value: column.values[index], sign: column.sign })
    }
    return out
  })

  return records.map((row, index) => index).sort((a, b) => {
    const left = lists[a]
    const right = lists[b]
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      const l = left[i]
      const r = right[i]
      if (l.value === null && r.value === null) continue
      if (l.value === null) return 1
      if (r.value === null) return -1
      const difference = typeof l.value === typeof r.value
        ? compareValues(l.value, r.value)
        : collator.compare(String(l.value), String(r.value))
      if (difference) return difference * l.sign
    }
    if (!left.length) return right.length ? 1 : 0
    if (!right.length) return -1
    return 0
  }).map(index => records[index])
}
