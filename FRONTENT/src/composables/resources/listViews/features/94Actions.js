const parseActions = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${label} must be an object with only, exclude, dense, and size props.`)
  }
  const props = {}
  for (const key of ['only', 'exclude', 'dense', 'size', 'max']) {
    const entry = value[key]
    if (entry === undefined) continue
    if (key === 'only' || key === 'exclude') {
      if (entry !== null && (!Array.isArray(entry) || entry.some(name => typeof name !== 'string'))) {
        throw new TypeError(`${label}.${key} must be an array of action keys or null.`)
      }
    } else if (key === 'max') {
      if (!Number.isInteger(entry) || entry < 0) {
        throw new TypeError(`${label}.max must be a whole number of 0 or more.`)
      }
    } else if (key === 'dense' ? typeof entry !== 'boolean' : typeof entry !== 'string' || !entry.trim()) {
      throw new TypeError(`${label}.${key} must be ${key === 'dense' ? 'a boolean' : 'a non-empty string'}.`)
    }
    props[key] = entry
  }
  return props
}

export default function actionsFeature (records, config = {}) {
  if (!Array.isArray(records)) throw new TypeError('[feature/Actions] records must be an array.')
  const name = config.listName || ''
  const label = `[feature/Actions] List "${name}"`
  const raw = config.view?.actions
  if (raw === false) {
    config.actionProps ||= {}
    for (const key of Object.keys(config.actionProps)) delete config.actionProps[key]
    return records
  }
  const core = raw == null ? {} : parseActions(raw, `${label}: actions`)
  if (core.max === undefined) core.max = 3
  const state = config.overrideFor?.(name, 'Actions')
  const file = `list${name}Actions.js`
  if (state?.status === 'error') {
    throw new Error(`${label}: ${file} failed to load. ${state.error?.message || state.error || ''}`)
  }
  const override = state?.status === 'ready' ? parseActions(state.module, `${label}: ${file}`) : {}
  Object.assign(config.actionProps ||= {}, core, override)
  return records
}
