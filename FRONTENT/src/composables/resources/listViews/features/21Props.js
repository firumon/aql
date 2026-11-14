const parseCount = (value, label, minimum) => {
  if (!Number.isInteger(value) || value < minimum) {
    throw new TypeError(`${label} must be an integer of ${minimum} or more.`)
  }
  return value
}

export default function propsFeature (records, config = {}) {
  if (!Array.isArray(records)) throw new TypeError('[feature/Props] records must be an array.')
  const name = config.listName || ''
  const label = `[feature/Props] List "${name}"`
  const view = config.view || {}
  const props = {}
  if (view.paginate != null) {
    if (typeof view.paginate !== 'boolean') throw new TypeError(`${label}: view.paginate must be true or false.`)
    props.paginate = view.paginate
  }
  if (view.perPage != null) props.perPage = parseCount(view.perPage, `${label}: view.perPage`, 1)
  if (view.threshold != null) props.threshold = parseCount(view.threshold, `${label}: view.threshold`, 0)
  if (view.props != null) {
    if (typeof view.props !== 'object' || Array.isArray(view.props)) {
      throw new TypeError(`${label}: view.props must be a props object.`)
    }
    Object.assign(props, view.props)
  }
  const state = config.overrideFor?.(name, 'Props')
  const file = `list${name}Props.js`
  if (state?.status === 'error') {
    throw new Error(`${label}: ${file} failed to load. ${state.error?.message || state.error || ''}`)
  }
  if (state?.status === 'ready') {
    const override = state.module
    if (!override || typeof override !== 'object' || Array.isArray(override)) {
      throw new TypeError(`${label}: ${file} must export a props object.`)
    }
    Object.assign(props, override)
  }
  if (Object.keys(props).length) Object.assign(config.itemProps ||= {}, props)
  return records
}
