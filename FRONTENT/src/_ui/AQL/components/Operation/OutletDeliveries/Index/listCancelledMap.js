const text = value => (value == null ? '' : String(value).trim())

export default function (row) {
  const count = `${row.displayDeliveryItemCount} items`
  return { displayCancelledDeliveryCaption: [count, text(row.CancelledComment)].filter(Boolean).join(' • ') }
}
