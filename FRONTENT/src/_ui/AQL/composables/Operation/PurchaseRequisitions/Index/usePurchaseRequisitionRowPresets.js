const text = (value) => String(value ?? '').trim()

export function joinParts (parts) {
  return (parts || []).filter((part) => text(part)).join(' • ')
}
