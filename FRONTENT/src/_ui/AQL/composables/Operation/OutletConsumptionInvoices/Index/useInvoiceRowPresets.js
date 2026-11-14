const text = (value) => (value == null ? '' : String(value).trim())

const HOUR = 3600000
const DAY = 86400000

function timeOf (value) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const raw = text(value)
  if (!raw) return NaN
  if (/^\d+$/.test(raw)) return Number(raw)
  return new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw).getTime()
}

export function elapsedLabel (value) {
  const at = timeOf(value)
  if (Number.isNaN(at)) return ''
  const gap = Math.max(0, Date.now() - at)
  if (gap < HOUR) return 'Just Now'
  if (gap < DAY) return `${Math.floor(gap / HOUR)} hours ago`
  const days = Math.floor(gap / DAY)
  if (days <= 99) return `${days} days ago`
  return `${Math.floor(days / 30)} months ago`
}
