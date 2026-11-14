import { itemPiece, parseLayout, parseTemplates, parseCells, distributeCells } from '../listItemProps'

export default function contentFeature (records, config = {}) {
  if (!Array.isArray(records)) throw new TypeError('[feature/Content] records must be an array.')
  const layout = itemPiece(config, 'layout', 'Layout', (value, label) => parseLayout(value, label, ['label', 'caption']))
  const labels = itemPiece(config, 'labels', 'Labels', parseTemplates)
  const captions = itemPiece(config, 'captions', 'Captions', parseTemplates)
  const content = itemPiece(config, null, 'Content', parseCells)
  const itemProps = config.itemProps ||= {}
  const hasProp = key => Object.prototype.hasOwnProperty.call(itemProps, key)
  const resolvedLayout = layout ?? (hasProp('layout') ? itemProps.layout : ['caption', 'label'])
  const resolvedLabels = labels ?? (hasProp('label') ? [itemProps.label] : [row => {
    if (row?.Name != null && row.Name !== '') return row.Name
    const parentKey = Array.isArray(row?._Parents) ? row._Parents[0] : null
    const parentName = parentKey == null ? undefined : row?._Parent?.[parentKey]?.Name
    if (parentName != null && parentName !== '') return parentName
    return row?.Date != null && row.Date !== '' ? row?.Code ?? '' : ''
  }])
  const resolvedCaptions = captions ?? (hasProp('caption') ? [itemProps.caption] : [row => {
    const username = row?.Username
    const date = row?.Date
    if (username != null && username !== '' && date != null && date !== '') {
      return `${username} * ${date}`
    }
    return [date, username, row?.Progress, row?.Code].find(value => value != null && value !== '') ?? ''
  }])
  const hasSheetDisplay = layout !== undefined || labels !== undefined || captions !== undefined
  const props = {}
  if (layout !== undefined || !hasProp('layout')) props.layout = resolvedLayout
  if (content !== undefined) props.content = content
  else if (hasSheetDisplay || !hasProp('content')) {
    const contentLayout = Array.isArray(resolvedLayout) ? resolvedLayout : ['caption', 'label']
    props.content = distributeCells(contentLayout, { label: resolvedLabels, caption: resolvedCaptions })
  }
  Object.assign(itemProps, props)
  return records
}
