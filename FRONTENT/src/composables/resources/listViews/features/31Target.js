export default function targetFeature (records, config = {}) {
  if (!Array.isArray(records)) throw new TypeError('[feature/Target] records must be an array.')
  const name = config.listName || ''
  const state = config.overrideFor?.(name, 'Target')
  if (state?.status === 'error') {
    throw new Error(`[feature/Target] List "${name}": list${name}Target.js failed to load. ${state.error?.message || state.error || ''}`)
  }
  const view = config.view || {}
  const hasViewTarget = Object.prototype.hasOwnProperty.call(view, 'target')
  const targetState = config.targetState ||= {}
  targetState.status = state?.status === 'loading' ? 'loading' : 'ready'
  targetState.hasTarget = state?.status === 'ready' || hasViewTarget
  targetState.value = state?.status === 'loading'
    ? undefined
    : state?.status === 'ready' ? state.module : hasViewTarget ? (view.target ?? 'view') : undefined
  return records
}
