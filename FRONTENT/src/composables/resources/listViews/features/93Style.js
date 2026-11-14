import { itemPiece, parseStyle, parseStyleOverride } from '../listItemProps'

export default function styleFeature (records, config = {}) {
  if (!Array.isArray(records)) throw new TypeError('[feature/Style] records must be an array.')
  const props = {}
  for (const [key, kind] of [
    ['icon', 'Icon'], ['iconColor', 'IconColor'], ['color', 'Color'], ['highlight', 'Highlight'],
    ['metaColor', 'MetaColor'], ['chipColor', 'ChipColor'], ['badgeColor', 'BadgeColor']
  ]) {
    const value = itemPiece(config, key, kind, parseStyle, parseStyleOverride)
    if (value === undefined) continue
    if (key === 'highlight') {
      props.highlight = value !== ''
      props.highlightColor = value
    } else props[key] = value
  }
  Object.assign(config.itemProps ||= {}, props)
  return records
}
