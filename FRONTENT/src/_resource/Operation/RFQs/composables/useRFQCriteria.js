import { computed } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { toDateOnly } from 'src/utils/dateHelpers'

const RESOURCE = 'RFQs'
const DEFINITIONS = [
  {
    column: 'CriterionPrice',
    name: 'Price',
    description: 'Total price of all quoted items, excluding taxes and other charges.',
    type: 'scaled',
    order: 'desc'
  },
  {
    column: 'CriterionPackaging',
    name: 'Packaging',
    description: 'Packaging type used for the quoted items.',
    type: 'fixed',
    options: ['Carton', 'Crate', 'Pallet', 'Bag']
  },
  {
    column: 'CriterionPaymentTerms',
    name: 'Payment terms',
    description: 'When the supplier expects payment for the order.',
    type: 'fixed',
    options: ['Full advance', 'Advance + Before Delivery', 'Advance + Before Delivery + After Delivery',
      'Advance + After Delivery', 'Full Before Delivery', 'Before Delivery + After Delivery', 'Full After Delivery']
  },
  {
    column: 'CriterionCreditPeriod',
    name: 'Credit period',
    description: 'Number of days of credit offered after delivery.',
    type: 'scaled',
    order: 'asc'
  },
  {
    column: 'CriterionShippingTerms',
    name: 'Shipping terms',
    description: 'Shipping term offered for delivery.',
    type: 'fixed',
    options: ['EXW', 'FOB', 'CIF', 'DDP']
  },
  {
    column: 'CriterionLeadTime',
    name: 'Lead time',
    description: 'Number of days from the PO date to delivery.',
    type: 'scaled',
    order: 'desc'
  },
  {
    column: 'CriterionQuotationValidity',
    name: 'Quotation validity',
    description: 'Number of days the quotation stays valid after submission.',
    type: 'scaled',
    order: 'asc'
  },
  {
    column: 'CriterionShipmentGrouping',
    name: 'Number of shipments',
    description: 'Number of shipments needed for the full order. One means all items arrive at once.',
    type: 'scaled',
    order: 'desc'
  },
  {
    column: 'CriterionExtraCharges',
    name: 'Charges',
    description: 'Total non-refundable taxes and other charges outside the item price.',
    type: 'scaled',
    order: 'desc'
  },
  {
    column: 'CriterionRefundableTaxAmount',
    name: 'Refundable tax amount',
    description: 'Tax the buyer can claim back from the government. Put other tax in charges.',
    type: 'scaled',
    order: 'desc'
  },
  {
    column: 'CriterionItemAvailability',
    name: 'Item availability',
    description: 'Whether the supplier can supply every requested item.',
    type: 'fixed',
    options: ['All requested items available', 'Not all requested items available']
  },
  {
    column: 'CriterionPartialOrderAcceptance',
    name: 'Partial order acceptance',
    description: 'Whether the supplier accepts an order for less than the full requested quantity.',
    type: 'fixed',
    options: ['Accepts partial quantities', 'Full quantity required']
  }
]
const text = (value) => String(value ?? '').trim()
const object = (value) => value && typeof value === 'object' && !Array.isArray(value)
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) && toDateOnly(value) === value
const decimal = (value, minimum, maximum) => typeof value === 'number' && Number.isFinite(value) &&
  value >= minimum && value <= maximum && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001

function parse (raw, fallback) {
  if (raw == null || raw === '') return fallback
  try { return JSON.parse(raw) } catch { return null }
}

function catalogueOf (config) {
  const settings = config?.settings || config?.ui?.settings || []
  if (!Array.isArray(settings)) return []
  const raw = settings.find((entry) => entry.name === 'RFQCriteria')?.value
  const value = typeof raw === 'string' ? parse(raw, null) : raw
  const legacyCatalogue = object(value) && Array.isArray(value.criteria)
  const names = Array.isArray(value) ? value
    : legacyCatalogue
      ? value.criteria.map((entry) => object(entry) ? entry.name : entry)
      : []
  const allowed = new Set(names.map((name) => text(name).toLowerCase()))
  const headers = new Set(config?.headers || [])
  return DEFINITIONS.filter((entry) => (legacyCatalogue || allowed.has(entry.name.toLowerCase())) && headers.has(entry.column))
}

function storedShape (value) {
  if (!object(value) || !text(value.name)) return false
  const keys = Object.keys(value)
  const weight = value.weight
  if (weight !== undefined && weight !== '' && (!Number.isInteger(weight) || weight < 1 || weight > 10)) return false
  if (value.type === 'scaled') {
    return ['name', 'type', 'order'].every((key) => keys.includes(key)) &&
      keys.every((key) => ['name', 'type', 'order', 'weight'].includes(key)) && ['asc', 'desc'].includes(value.order)
  }
  if (value.type !== 'fixed' || !Array.isArray(value.options)) return false
  return ['name', 'type', 'options'].every((key) => keys.includes(key)) &&
    keys.every((key) => ['name', 'type', 'options', 'weight'].includes(key)) && value.options.every((entry) =>
      object(entry) && typeof entry.name === 'string' &&
      Object.keys(entry).every((key) => ['name', 'description', 'points', 'custom'].includes(key)) &&
      (entry.description === undefined || typeof entry.description === 'string') &&
      (entry.custom === undefined || typeof entry.custom === 'boolean') &&
      (typeof entry.points === 'number' || entry.points === ''))
}

function readCriteria (record, catalogue) {
  const selected = []
  const errors = []
  for (const definition of catalogue) {
    const column = definition.column
    if (!text(record[column])) continue
    const value = parse(record[column], null)
    if (storedShape(value)) {
      const matches = value.name === definition.name && value.type === definition.type &&
        (definition.type === 'scaled' ? true :
          value.options.filter((option) => !option.custom).length === definition.options.length &&
          value.options.filter((option) => !option.custom).every((option, index) => option.name === definition.options[index]))
      if (matches) {
        selected.push({ ...value, weight: value.weight ?? 1, description: definition.description, id: column, column,
          options: value.options?.map((option, index) => ({ ...option, description: option.description || '',
            id: `${column}-${index}` })) })
        continue
      }
    }
    const legacy = object(value) && value.v === 1 && typeof value.id === 'string' && typeof value.name === 'string' &&
      Array.isArray(value.options) && object(value.rule)
    let restored = null
    if (legacy && value.kind === 'number' && definition.type === 'scaled') {
      const order = value.rule.direction === 'lower' ? 'desc' : value.rule.direction === 'higher' ? 'asc' : ''
      if (order) restored = { name: definition.name, type: 'scaled', order, weight: 1,
        description: definition.description, id: column, column }
    } else if (legacy && value.kind === 'choice' && definition.type === 'fixed') {
      const oldOptions = new Map(value.options.filter(object).map((option) => [text(option.name).toLowerCase(), option.points]))
      restored = { name: definition.name, type: 'fixed', weight: 1, description: definition.description,
        options: definition.options.map((name, index) => ({ name, description: '',
          points: oldOptions.get(name.toLowerCase()) ?? '', id: `${column}-${index}` })), id: column, column }
    }
    if (restored) {
      selected.push(restored)
      continue
    }
    errors.push({ column, message: `${column} has old or unreadable data. Its saved text has been kept.` })
  }
  return { selected, errors }
}

function criterionError (criterion) {
  if (!text(criterion.name)) return 'Enter a criterion name.'
  if (!Number.isInteger(criterion.weight) || criterion.weight < 1 || criterion.weight > 10) {
    return `${criterion.name}: set a weight from 1 to 10.`
  }
  if (criterion.type === 'scaled') {
    if (!['asc', 'desc'].includes(criterion.order) || criterion.options !== undefined) {
      return `${criterion.name}: the scaled rule must set an ascending or descending order.`
    }
    return ''
  }
  if (criterion.type !== 'fixed' || !Array.isArray(criterion.options) || !criterion.options.length) {
    return `${criterion.name}: choose fixed options or a scaled number rule.`
  }
  const names = new Set()
  for (const option of criterion.options) {
    if (!object(option) || !text(option.name)) return `${criterion.name}: every option needs a name.`
    const name = text(option.name).toLowerCase()
    if (names.has(name)) return `${criterion.name}: option names must be different.`
    names.add(name)
    if (!decimal(option.points, 0, 10)) return `${criterion.name}: give every option 0 to 10 points, with up to two decimal places.`
  }
  return ''
}

function savedCriterion (criterion) {
  const { id, column, description, ...value } = criterion
  if (Array.isArray(value.options)) {
    value.options = value.options.map(({ id: optionId, ...option }) => option)
  }
  return value
}

export function useRFQCriteria () {
  const config = useResourceConfig(RESOURCE)
  const source = useRecord()
  return source.remember('useRFQCriteria', () => {
    const catalogue = computed(() => catalogueOf(config.config.value))
    const columns = computed(() => catalogue.value.map((entry) => entry.column))
    const snapshot = (record = {}) => {
      return readCriteria(record, catalogue.value)
    }
    const optionsOf = (criterion) => {
      const definition = catalogue.value.find((entry) => entry.column === criterion.id)
      const selected = new Set((criterion.options || []).map((entry) => text(entry.name).toLowerCase()))
      return (definition?.options || []).map((name) => ({
        name,
        selected: selected.has(name.toLowerCase())
      }))
    }
    const stepsOf = (record, editing = false) => {
      const selected = snapshot(record).selected
      if (editing) {
        return {
          criteria: 1, basics: 2, selected,
          criterionStart: 3,
          suppliers: null,
          review: selected.length + 3
        }
      }
      return {
        source: 1,
        items: 2,
        criteria: 3,
        selected,
        criterionStart: 4,
        suppliers: selected.length + 4,
        review: selected.length + 5
      }
    }
    const termsOf = (record) => [...snapshot(record).selected]
      .sort((a, b) => b.weight - a.weight)
      .map((criterion) => {
        const options = [...(criterion.options || [])].sort((a, b) => b.points - a.points)
        const method = criterion.type === 'scaled'
          ? `${criterion.order === 'asc' ? 'Higher' : 'Lower'} value is better` : ''
        const details = method || options.map((option) =>
          `${option.name}${option.description ? ` (${option.description})` : ''}: ${option.points} points`).join('; ')
        return { label: criterion.name, value: `Weight ${criterion.weight} · ${details}`,
          weight: criterion.weight, method, options }
      })
    return { catalogue, columns, snapshot, optionsOf, stepsOf, termsOf,
      ready: computed(() => catalogue.value.length > 0), criterionError, validDate }
  })
}

export function buildRFQCriteriaNodes ({ record = {}, code = '', operation, id, optionIndex, value, catalogue = [] } = {}) {
  const state = readCriteria(record, catalogue)
  const criterion = state.selected.find((entry) => entry.id === id)
  const definition = catalogue.find((entry) => entry.column === id)
  const blocked = state.errors.find((entry) => entry.column === id)
  if (blocked && operation !== 'select') return [{ valid: false, message: blocked.message }]
  const changes = {}
  if (operation === 'select') {
    if (!definition) return [{ valid: false, message: 'This criterion is not in the sheet catalogue.' }]
    changes[id] = criterion || text(record[id]) ? '' : JSON.stringify(definition.type === 'fixed'
      ? { name: definition.name, type: 'fixed', weight: 1,
        options: definition.options.map((name) => ({ name, description: '', points: 0 })) }
      : { name: definition.name, type: 'scaled', order: definition.order, weight: 1 })
  } else if (['weight', 'order', 'option-points', 'add-option', 'remove-option'].includes(operation)) {
    if (!criterion) return [{ valid: false, message: 'Choose the criterion first.' }]
    const next = savedCriterion(criterion)
    if (operation === 'weight') {
      const weight = value === '' || value == null ? '' : Number(value)
      if (weight !== '' && (!Number.isInteger(weight) || weight < 1 || weight > 10)) {
        return [{ valid: false, message: 'Weight must be from 1 to 10.' }]
      }
      next.weight = weight
    } else if (operation === 'order') {
      if (criterion.type !== 'scaled' || !['asc', 'desc'].includes(value)) {
        return [{ valid: false, message: 'Choose higher or lower value as best.' }]
      }
      next.order = value
    } else {
      if (criterion.type !== 'fixed') return [{ valid: false, message: 'Only fixed criteria have options.' }]
      if (operation === 'add-option') {
        const name = text(value?.name)
        const points = value?.points === '' || value?.points == null ? '' : Number(value.points)
        if (!name) return [{ valid: false, message: 'Enter an option name.' }]
        if (next.options.some((entry) => text(entry.name).toLowerCase() === name.toLowerCase())) {
          return [{ valid: false, message: 'Option names must be different.' }]
        }
        if (!decimal(points, 0, 10)) return [{ valid: false, message: 'Points must be from 0 to 10.' }]
        next.options.push({ name, description: String(value.description ?? '').trim(), points, custom: true })
      } else {
        const targetIndex = Number.isInteger(optionIndex)
          ? optionIndex
          : criterion.options.findIndex((entry) => entry.id === optionIndex)
        const option = next.options[targetIndex]
        if (!option) return [{ valid: false, message: 'Choose the option first.' }]
        if (operation === 'remove-option') {
          if (!option.custom) return [{ valid: false, message: 'Only custom options can be removed.' }]
          next.options.splice(targetIndex, 1)
        } else {
          const points = value === '' || value == null ? '' : Number(value)
          if (points !== '' && !decimal(points, 0, 10)) return [{ valid: false, message: 'Points must be from 0 to 10.' }]
          option.points = points
        }
      }
    }
    changes[id] = JSON.stringify(next)
  } else return [{ valid: false, message: 'This criterion change is not supported.' }]
  const recordCode = text(code || record.Code)
  return [{ resource: RESOURCE, merge: true, ...(recordCode ? { code: recordCode } : {}), record: changes,
    permissions: recordCode ? { update: 'You are not allowed to update this RFQ.' } : { create: 'You are not allowed to create an RFQ.' } }]
}

export function validateRFQCriteriaNodes ({ record = {}, original = {}, criterionId = '', namesOnly = false } = {}) {
  const reader = useRFQCriteria()
  const state = reader.snapshot(record)
  if (!reader.ready.value) return [{ valid: false, message: 'RFQ criteria are not set up in sheet settings yet.' }]
  const changedError = state.errors.find((error) => record[error.column] !== original[error.column])
  if (changedError) return [{ valid: false, message: changedError.message }]
  const names = new Set()
  for (const criterion of state.selected) {
    const name = text(criterion.name).toLowerCase()
    if (!name || names.has(name)) {
      return [{ valid: false, message: 'Criterion names must be different and not blank.' }]
    }
    names.add(name)
    if (namesOnly || criterionId && criterion.id !== criterionId) continue
    const error = criterionError(criterion)
    if (error && (!original.Code || record[criterion.column] !== original[criterion.column])) {
      return [{ valid: false, message: error }]
    }
  }
  return []
}
