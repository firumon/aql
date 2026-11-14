const text = value => (value == null ? '' : String(value).trim())

export default function (row) {
  const date = row.displayConsumptionDate
  const reason = text(row.ProgressCancelledComment)
  return { displayCancelledConsumptionCaption: reason ? `${date} · ${reason}` : date }
}
