import { decorateRow } from 'src/utils/appHelpers'
import { readField } from 'src/utils/sortHelpers'

export default function mapFeature (records, config = {}) {
  if (!Array.isArray(records)) throw new TypeError('[feature/Map] records must be an array.')
  const name = config.listName || ''
  const label = `[feature/Map] List "${name}"`
  const state = config.overrideFor?.(name, 'Map')
  const file = `list${name}Map.js`
  if (state?.status === 'error') {
    throw new Error(`${label}: ${file} failed to load. ${state.error?.message || state.error || ''}`)
  }
  if (state?.status !== 'ready') return records
  const context = {
    listName: name,
    view: config.view || null,
    user: config.ctx?.user,
    term: config.term,
    masterResources: config.masterResources,
    readField
  }
  return records.map((row, index) => {
    let facts
    try {
      facts = state.module(row, context)
    } catch (cause) {
      throw new Error(`${label}: ${file} failed at row ${index}.`, { cause })
    }
    if (!facts || typeof facts !== 'object' || Array.isArray(facts)) {
      throw new TypeError(`${label}: ${file} returned invalid facts at row ${index}; expected a non-null, non-array object.`)
    }
    return decorateRow(row, facts)
  })
}
