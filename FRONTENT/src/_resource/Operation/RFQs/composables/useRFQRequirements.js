import { computed } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { toDateOnly } from 'src/utils/dateHelpers'

const RESOURCE = 'RFQs'
const DEFINITIONS = [
  {
    column: 'RequirementPrice',
    name: 'Price',
    description: 'Total price of all quoted items, excluding taxes and other charges.',
    type: 'scaled',
    order: 'desc'
  },
  {
    column: 'RequirementPackaging',
    name: 'Packaging',
    description: 'Packaging type used for the quoted items.',
    type: 'fixed',
    options: ['Carton', 'Crate', 'Pallet', 'Bag']
  },
  {
    column: 'RequirementPaymentTerms',
    name: 'Payment terms',
    description: 'When the supplier expects payment for the order.',
    type: 'fixed',
    options: ['Full advance', 'Advance + Before Delivery', 'Advance + Before Delivery + After Delivery',
      'Advance + After Delivery', 'Full Before Delivery', 'Before Delivery + After Delivery', 'Full After Delivery']
  },
  {
    column: 'RequirementCreditPeriod',
    name: 'Credit period',
    description: 'Number of days of credit offered after delivery.',
    type: 'scaled',
    order: 'asc'
  },
  {
    column: 'RequirementShippingTerms',
    name: 'Shipping terms',
    description: 'Shipping term offered for delivery.',
    type: 'fixed',
    options: ['EXW', 'FOB', 'CIF', 'DDP']
  },
  {
    column: 'RequirementLeadTime',
    name: 'Lead time',
    description: 'Number of days from the PO date to delivery.',
    type: 'scaled',
    order: 'desc'
  },
  {
    column: 'RequirementQuotationValidity',
    name: 'Quotation validity',
    description: 'Number of days the quotation stays valid after submission.',
    type: 'scaled',
    order: 'asc'
  },
  {
    column: 'RequirementShipmentGrouping',
    name: 'Number of shipments',
    description: 'Number of shipments needed for the full order. One means all items arrive at once.',
    type: 'scaled',
    order: 'desc'
  },
  {
    column: 'RequirementExtraCharges',
    name: 'Charges',
    description: 'Total non-refundable taxes and other charges outside the item price.',
    type: 'scaled',
    order: 'desc'
  },
  {
    column: 'RequirementRefundableTaxAmount',
    name: 'Refundable tax amount',
    description: 'Tax the buyer can claim back from the government. Put other tax in charges.',
    type: 'scaled',
    order: 'desc'
  },
  {
    column: 'RequirementItemAvailability',
    name: 'Item availability',
    description: 'Whether the supplier can supply every requested item.',
    type: 'fixed',
    options: ['All requested items available', 'Not all requested items available']
  },
  {
    column: 'RequirementPartialOrderAcceptance',
    name: 'Partial order acceptance',
    description: 'Whether the supplier accepts an order for less than the full requested quantity.',
    type: 'fixed',
    options: ['Accepts partial quantities', 'Full quantity required']
  },
  {
    column: 'RequirementQuality',
    name: 'Quality',
    description: 'Item quality compared to the requested specification.',
    type: 'scaled',
    order: 'asc'
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
  const setting = settings.find((entry) => entry.name === 'RFQRequirements')
  const raw = (setting || settings.find((entry) => entry.name === 'RFQCriteria'))?.value
  const value = typeof raw === 'string' ? parse(raw, null) : raw
  const legacyCatalogue = object(value) && Array.isArray(value.requirements)
  const names = Array.isArray(value) ? value
    : legacyCatalogue
      ? value.requirements.map((entry) => object(entry) ? entry.name : entry)
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

function readRequirements (record, catalogue) {
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

export function requirementError (requirement) {
  if (!text(requirement.name)) return 'Enter a requirement name.'
  if (!Number.isInteger(requirement.weight) || requirement.weight < 1 || requirement.weight > 10) {
    return `${requirement.name}: set a weight from 1 to 10.`
  }
  if (requirement.type === 'scaled') {
    if (!['asc', 'desc'].includes(requirement.order) || requirement.options !== undefined) {
      return `${requirement.name}: the scaled rule must set an ascending or descending order.`
    }
    return ''
  }
  if (requirement.type !== 'fixed' || !Array.isArray(requirement.options) || !requirement.options.length) {
    return `${requirement.name}: choose fixed options or a scaled number rule.`
  }
  const names = new Set()
  for (const option of requirement.options) {
    if (!object(option) || !text(option.name)) return `${requirement.name}: every option needs a name.`
    const name = text(option.name).toLowerCase()
    if (names.has(name)) return `${requirement.name}: option names must be different.`
    names.add(name)
    if (!decimal(option.points, 0, 10)) return `${requirement.name}: give every option 0 to 10 points, with up to two decimal places.`
  }
  return ''
}

function savedRequirement (requirement) {
  const { id, column, description, ...value } = requirement
  if (Array.isArray(value.options)) {
    value.options = value.options.map(({ id: optionId, ...option }) => option)
  }
  return value
}

export function useRFQRequirements () {
  const config = useResourceConfig(RESOURCE)
  const source = useRecord()
  return source.remember('useRFQRequirements', () => {
    const catalogue = computed(() => catalogueOf(config.config.value))
    const columns = computed(() => catalogue.value.map((entry) => entry.column))
    const snapshot = (record = {}) => {
      return readRequirements(record, catalogue.value)
    }
    const optionsOf = (requirement) => {
      const definition = catalogue.value.find((entry) => entry.column === requirement.id)
      const selected = new Set((requirement.options || []).map((entry) => text(entry.name).toLowerCase()))
      return (definition?.options || []).map((name) => ({
        name,
        selected: selected.has(name.toLowerCase())
      }))
    }
    const stepsOf = (record, editing = false) => {
      const selected = snapshot(record).selected
      return {
        source: 1, items: 1, basics: 2, requirements: 3, criteria: 3, selected,
        requirementStart: 4, criterionStart: 4,
        suppliers: editing ? null : selected.length + 4,
        review: selected.length + (editing ? 4 : 5)
      }
    }

    const termsOf = (record) => [...snapshot(record).selected]
      .sort((a, b) => b.weight - a.weight)
      .map((requirement) => {
        const options = [...(requirement.options || [])].sort((a, b) => b.points - a.points)
        const method = requirement.type === 'scaled'
          ? `${requirement.order === 'asc' ? 'Higher' : 'Lower'} value is better` : ''
        const details = method || options.map((option) =>
          `${option.name}${option.description ? ` (${option.description})` : ''}: ${option.points} points`).join('; ')
        return { label: requirement.name, value: `Weight ${requirement.weight} · ${details}`,
          weight: requirement.weight, method, options }
      })
    return { catalogue, columns, snapshot, optionsOf, stepsOf, termsOf,
      ready: computed(() => catalogue.value.length > 0), requirementError, criterionError: requirementError, validDate }
  })
}

export function buildRFQRequirementsNodes ({ record = {}, code = '', operation, id, optionIndex, value, catalogue = [] } = {}) {
  const state = readRequirements(record, catalogue)
  const requirement = state.selected.find((entry) => entry.id === id)
  const definition = catalogue.find((entry) => entry.column === id)
  const blocked = state.errors.find((entry) => entry.column === id)
  if (blocked && !['select', 'set-weight'].includes(operation)) return [{ valid: false, message: blocked.message }]
  const changes = {}
  if (['select', 'set-weight'].includes(operation)) {
    if (!definition) return [{ valid: false, message: 'This requirement is not in the sheet catalogue.' }]
    const weight = operation === 'select' ? (requirement || text(record[id]) ? 0 : 1)
      : value === '' || value == null ? 0 : Number(value)
    if (!Number.isInteger(weight) || weight < 0 || weight > 10) {
      return [{ valid: false, message: 'Weight must be from 0 to 10.' }]
    }
    if (!weight && !text(record[id])) return []
    changes[id] = !weight ? '' : JSON.stringify(requirement ? { ...savedRequirement(requirement), weight }
      : definition.type === 'fixed'
        ? { name: definition.name, type: 'fixed', weight,
          options: definition.options.map((name) => ({ name, description: '', points: 0 })) }
        : { name: definition.name, type: 'scaled', order: definition.order, weight })
  } else if (['weight', 'order', 'option-points', 'add-option', 'remove-option'].includes(operation)) {
    if (!requirement) return [{ valid: false, message: 'Choose the requirement first.' }]
    const next = savedRequirement(requirement)
    if (operation === 'weight') {
      const weight = value === '' || value == null ? '' : Number(value)
      if (weight !== '' && (!Number.isInteger(weight) || weight < 1 || weight > 10)) {
        return [{ valid: false, message: 'Weight must be from 1 to 10.' }]
      }
      next.weight = weight
    } else if (operation === 'order') {
      if (requirement.type !== 'scaled' || !['asc', 'desc'].includes(value)) {
        return [{ valid: false, message: 'Choose higher or lower value as best.' }]
      }
      next.order = value
    } else {
      if (requirement.type !== 'fixed') return [{ valid: false, message: 'Only fixed requirements have options.' }]
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
          : requirement.options.findIndex((entry) => entry.id === optionIndex)
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
  } else return [{ valid: false, message: 'This requirement change is not supported.' }]
  const recordCode = text(code || record.Code)
  return [{ resource: RESOURCE, merge: true, ...(recordCode ? { code: recordCode } : {}), record: changes,
    permissions: recordCode ? { update: 'You are not allowed to update this RFQ.' } : { create: 'You are not allowed to create an RFQ.' } }]
}

export function validateRFQRequirementsNodes ({ record = {}, original = {}, requirementId = '', criterionId = '', namesOnly = false } = {}) {
  const reader = useRFQRequirements()
  const state = reader.snapshot(record)
  if (!reader.ready.value) return [{ valid: false, message: 'RFQ requirements are not set up in sheet settings yet.' }]
  const changedError = state.errors.find((error) => record[error.column] !== original[error.column])
  if (changedError) return [{ valid: false, message: changedError.message }]
  const names = new Set()
  for (const requirement of state.selected) {
    const name = text(requirement.name).toLowerCase()
    if (!name || names.has(name)) {
      return [{ valid: false, message: 'Requirement names must be different and not blank.' }]
    }
    names.add(name)
    if (namesOnly || (requirementId || criterionId) && requirement.id !== (requirementId || criterionId)) continue
    const error = requirementError(requirement)
    if (error && (!original.Code || record[requirement.column] !== original[requirement.column])) {
      return [{ valid: false, message: error }]
    }
  }
  return []
}
