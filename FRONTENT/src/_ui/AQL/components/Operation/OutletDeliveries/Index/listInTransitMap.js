const text = value => (value == null ? '' : String(value).trim())

export default function (row) {
  const departed = text(row.ProgressInTransitBy)
  const count = `${row.displayDeliveryItemCount} items`
  return { displayInTransitCaption: [count, departed ? `departed with ${departed}` : ''].filter(Boolean).join(' • ') }
}
