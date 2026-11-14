import { unref } from 'vue'
import { readField, sortRecords } from 'src/utils/sortHelpers'
import { prepareFilter, evaluatePreparedFilter, normalizeOperator, OPERATORS } from 'src/utils/tokenEvaluator'

const types = ['auto', 'text', 'number', 'date', 'unix', 'epoch']
const aggregates = ['min', 'max', 'sum', 'count']

const normalizeOn = (node, label) => {
  if (Array.isArray(node)) return { type: 'group', logic: 'AND', items: node.map(item => normalizeOn(item, label)) }
  if (!node || typeof node !== 'object') throw new Error(`${label}: on must be a condition, group, or array.`)
  if (node.type === 'group' || (!node.type && Array.isArray(node.items))) {
    const logic = String(node.logic || 'AND').toUpperCase()
    if (!['AND', 'OR'].includes(logic) || !Array.isArray(node.items)) throw new Error(`${label}: invalid on group.`)
    return { type: 'group', logic, items: node.items.map(item => normalizeOn(item, label)) }
  }
  if (node.type && node.type !== 'condition') throw new Error(`${label}: invalid on condition type.`)
  const operator = normalizeOperator(node.operator)
  if (typeof node.column !== 'string' || !node.column.trim() || !OPERATORS.includes(operator)) {
    throw new Error(`${label}: on needs a column and a valid operator.`)
  }
  readField(null, node.column)
  return { type: 'condition', column: node.column, operator, value: node.value }
}

const prepareOrder = (order, ctx, listName) => {
  if (order == null || order === false) return []
  if (!Array.isArray(order)) throw new Error(`[Order] List "${listName}": order must be an array.`)
  return order.map((rule, index) => {
    const label = `[Order] List "${listName}", rule ${index + 1}`
    if (!rule || typeof rule !== 'object' || Array.isArray(rule) || typeof rule.column !== 'string' || !rule.column.trim()) {
      throw new Error(`${label}: column is required.`)
    }
    readField(null, rule.column)
    const direction = String(rule.order ?? 'asc').toLowerCase()
    const type = String(rule.type ?? 'auto').toLowerCase()
    const aggregate = rule.aggregate == null ? null : String(rule.aggregate).toLowerCase()
    if (!['asc', 'desc'].includes(direction)) throw new Error(`${label}: order must be asc or desc.`)
    if (!types.includes(type)) throw new Error(`${label}: type must be ${types.join(', ')}.`)
    if (aggregate !== null && !aggregates.includes(aggregate)) throw new Error(`${label}: invalid aggregate.`)
    const hasOn = Object.prototype.hasOwnProperty.call(rule, 'on')
    const on = rule.on && rule.on !== true ? prepareFilter(normalizeOn(rule.on, label), ctx, { strictColumn: false }) : null
    const matches = !hasOn || rule.on === true ? null : !rule.on ? () => false : row => evaluatePreparedFilter(on, row)
    return { column: rule.column, order: direction, type, aggregate, matches }
  })
}

export default function orderFeature (records, config) {
  if (!Array.isArray(records)) throw new TypeError(`[feature/Order] records must be an array, got ${typeof records}`)
  const view = config?.view || null
  const listName = String(config?.listName || '')
  const overrideState = config?.overrideFor?.(listName, 'Order')
  const rules = prepareOrder(view?.order, config?.ctx || {}, listName)
  const coreRows = sortRecords(records, rules)

  if (!overrideState || overrideState.status === 'none' || overrideState.status === 'loading') return coreRows
  if (overrideState.status === 'error') {
    throw overrideState.error || new Error(`[feature/Order] list${listName}Order.js failed to load.`)
  }
  if (overrideState.status !== 'ready') return coreRows
  if (typeof overrideState.module !== 'function') {
    throw new TypeError(`[feature/Order] list${listName}Order.js must export a function, got ${typeof overrideState.module}`)
  }
  const rows = unref(overrideState.module(coreRows, records, view))
  if (!Array.isArray(rows)) {
    throw new TypeError(`[feature/Order] list${listName}Order.js must return an array, got ${typeof rows}`)
  }
  return rows
}
