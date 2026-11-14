import { itemPiece, parseLayout, parseTemplates, parseCells, distributeCells } from '../listItemProps'

export default function metaFeature (records, config = {}) {
  if (!Array.isArray(records)) throw new TypeError('[feature/Meta] records must be an array.')
  const layout = itemPiece(config, 'metaLayout', 'MetaLayout',
    (value, label) => parseLayout(value, label, ['chip', 'badge', 'label', 'caption']))
  const chip = itemPiece(config, 'metaChip', 'MetaChip', parseTemplates)
  const badge = itemPiece(config, 'metaBadge', 'MetaBadge', parseTemplates)
  const label = itemPiece(config, 'metaLabel', 'MetaLabel', parseTemplates)
  const caption = itemPiece(config, 'metaCaption', 'MetaCaption', parseTemplates)
  const meta = itemPiece(config, null, 'Meta', parseCells)
  const chipOutline = itemPiece(config, 'chipOutline', 'ChipOutline', parseBoolean)
  const itemProps = config.itemProps ||= {}
  const fallbackLayout = ['label', 'caption']
  if (chip !== undefined || itemProps.chip != null) fallbackLayout.push('chip')
  if (badge !== undefined || itemProps.badge != null) fallbackLayout.push('badge')
  const resolvedLayout = layout ?? itemProps.metaLayout ?? fallbackLayout
  const props = { metaLayout: resolvedLayout }
  if (chipOutline !== undefined) props.chipOutline = chipOutline
  if (meta !== undefined) props.meta = meta
  else if (chip !== undefined || badge !== undefined || label !== undefined || caption !== undefined) {
    props.meta = distributeCells(resolvedLayout, { chip, badge, label, caption })
  }
  Object.assign(itemProps, props)
  return records
}

function parseBoolean (value, label) {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be true or false.`)
  return value
}
