import { readField } from 'src/utils/sortHelpers'

export const itemPiece = (config, key, kind, parse, parseOverride = parse) => {
  const item = config?.view?.item
  const label = `[feature/${kind}] List "${config?.listName || ''}"`
  if (item != null && (typeof item !== 'object' || Array.isArray(item))) {
    throw new TypeError(`${label}: item must be an object.`)
  }
  const raw = key ? item?.[key] : undefined
  const core = raw == null ? undefined : parse(raw, `${label}: item.${key}`)
  const state = config?.overrideFor?.(config?.listName || '', kind)
  const file = `list${config?.listName || ''}${kind}.js`
  if (state?.status === 'error') {
    throw new Error(`${label}: ${file} failed to load. ${state.error?.message || state.error || ''}`)
  }
  return state?.status === 'ready' ? parseOverride(state.module, `${label}: ${file}`) : core
}

export const parseList = (value, label) => {
  if (typeof value !== 'string' && !Array.isArray(value)) {
    throw new TypeError(`${label} must be a comma-separated string or array.`)
  }
  const items = Array.isArray(value) ? value : value.trim() ? value.split(',') : []
  return items.map(item => typeof item === 'string' ? item.trim() : item)
}

export const parseLayout = (value, label, kinds) => {
  const layout = parseList(value, label)
  if (layout.some(slot => !kinds.includes(slot))) {
    throw new TypeError(`${label} must contain only ${kinds.join(', ')}.`)
  }
  return layout
}

export const parseTemplate = (value, label) => {
  if (typeof value !== 'string') {
    if (value === false || value == null || typeof value === 'function' ||
      (typeof value === 'object' && (value.render || value.setup || value.template || value.__file))) return value
    throw new TypeError(`${label} must contain strings, functions, components, or empty cells.`)
  }
  const parts = []
  const pattern = /\{\{|\{([^{}]*)\}/g
  let offset = 0
  let match
  let dynamic = false
  while ((match = pattern.exec(value))) {
    parts.push(value.slice(offset, match.index))
    const path = match[1]?.trim()
    if (match[0] === '{{') {
      parts.push('{')
      dynamic = true
    } else if (/^[\w$]+(?:\.[\w$]+)*$/.test(path || '')) {
      try {
        readField(null, path)
      } catch (error) {
        throw new TypeError(`${label}: ${error.message}`)
      }
      parts.push(row => readField(row, path) ?? '')
      dynamic = true
    } else {
      parts.push(match[0])
    }
    offset = pattern.lastIndex
  }
  if (!dynamic) return value
  parts.push(value.slice(offset))
  return row => parts.map(part => typeof part === 'function' ? part(row) : part).join('')
}

export const parseTemplates = (value, label) => typeof value === 'function'
  ? [value] : parseList(value, label).map(item => parseTemplate(item, label))

export const parseCells = (value, label) => {
  if (!Array.isArray(value)) throw new TypeError(`${label} must export a full AppList array.`)
  return value
}

export const distributeCells = (layout, templates) => {
  const indexes = Object.fromEntries(Object.keys(templates).map(kind => [kind, 0]))
  return layout.map(kind => templates[kind]?.[indexes[kind]++] ?? false)
}

export const parseStyleOverride = (value, label) => {
  if (typeof value !== 'string' && typeof value !== 'function') {
    throw new TypeError(`${label} must export a string or a function(item).`)
  }
  return value
}

export const parseStyle = (value, label, rowStyle = true) => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    typeof value.column !== 'string' || !value.column.trim()) {
    throw new TypeError(`${label} must be a string or an object with column and optional map and default.`)
  }
  const hasMap = Object.hasOwn(value, 'map')
  if (hasMap && (!value.map || typeof value.map !== 'object' || Array.isArray(value.map))) {
    throw new TypeError(`${label}: map must be an object.`)
  }
  const column = value.column.trim()
  try {
    readField(null, column)
  } catch (error) {
    throw new TypeError(`${label}: ${error.message}`)
  }
  const fallback = value.default ?? ''
  if (typeof fallback !== 'string') throw new TypeError(`${label}: default must be a string.`)
  if (hasMap && Object.values(value.map).some(entry => typeof entry !== 'string')) {
    throw new TypeError(`${label}: map values must be strings.`)
  }
  if (!rowStyle) return fallback || undefined
  if (!hasMap) {
    return row => {
      const result = readField(row, column)
      return typeof result === 'string' && result.trim() ? result : fallback
    }
  }
  const entries = new Map()
  for (const [key, result] of Object.entries(value.map)) {
    const normalized = key.trim().toLowerCase()
    if (!entries.has(normalized)) entries.set(normalized, result)
  }
  return row => entries.get(String(readField(row, column)).trim().toLowerCase()) ?? fallback
}
