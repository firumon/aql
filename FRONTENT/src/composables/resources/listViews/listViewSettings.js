const summaryKeys = [
  'SearchText', 'searchText', '_searchText',
  'Summary', 'summary', '_summary',
  'SummarySearchText', 'summarySearchText', '_summarySearchText'
]

const factKeys = ['facts', '_facts', 'rowFacts', '_rowFacts']

export function listSearchText (row, visited = new Set()) {
  if (row == null) return ''
  if (typeof row !== 'object') return String(row).toLowerCase()
  if (visited.has(row)) return ''
  visited.add(row)
  if (Array.isArray(row)) return row.map(value => listSearchText(value, visited)).join(' ')

  const values = []
  for (const key of Object.keys(row)) {
    if (key.startsWith('_') || key.startsWith('$')) continue
    const value = row[key]
    if (value != null && (typeof value !== 'object' || Array.isArray(value))) {
      values.push(listSearchText(value, visited))
    }
  }
  for (const key of [...summaryKeys, ...factKeys]) {
    values.push(listSearchText(row[key], visited))
  }
  const parentKeys = Array.isArray(row._Parents) ? row._Parents : (row._Parents ? [row._Parents] : [])
  for (const key of parentKeys) {
    values.push(listSearchText(row._Parent?.[key] ?? row[key], visited))
  }
  values.push(listSearchText(row.$parent, visited))
  if (row._Parent && typeof row._Parent === 'object') {
    for (const parent of Object.values(row._Parent)) {
      values.push(listSearchText(parent, visited))
    }
  }
  return values.filter(Boolean).join(' ')
}
