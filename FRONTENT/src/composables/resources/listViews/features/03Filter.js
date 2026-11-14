import { unref } from 'vue'
import { prepareFilter, evaluatePreparedFilter } from 'src/utils/tokenEvaluator'

const KIND = 'Filter'

export default function filterFeature (records, config) {
  if (!Array.isArray(records)) {
    throw new TypeError(`[feature/${KIND}] records must be an array, got ${typeof records}`)
  }
  const view = config?.view || null
  const listName = String(config?.listName || '')
  const overrideState = config?.overrideFor ? config.overrideFor(listName, KIND) : null

  const prepared = prepareFilter(view?.filter, config?.ctx || {}, { strictColumn: false })
  const coreRows = prepared ? records.filter(row => evaluatePreparedFilter(prepared, row)) : records

  if (!overrideState || overrideState.status === 'none') return coreRows
  if (overrideState.status === 'error') {
    throw overrideState.error || new Error(`[feature/${KIND}] Override for "${listName}" failed to load.`)
  }
  if (overrideState.status !== 'ready') return coreRows

  const override = overrideState.module
  if (typeof override !== 'function') {
    throw new TypeError(`[feature/${KIND}] list${listName}Filter.js must export a function, got ${typeof override}`)
  }
  const out = override(coreRows, records, view)
  const resolved = (out && typeof out === 'object' && 'value' in out) ? unref(out) : out
  if (!Array.isArray(resolved)) {
    throw new TypeError(`[feature/${KIND}] list${listName}Filter.js must return an array, got ${typeof resolved}`)
  }
  return resolved
}
