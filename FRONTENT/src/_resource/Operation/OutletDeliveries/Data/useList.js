import { useRecord } from 'src/composables/resources/useRecord'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { decorateRow } from 'src/utils/appHelpers'
import { buildOutletDeliveryQueue } from '../composables/useOutletDeliveryQueue'
import {
  ageColor,
  daysSince,
  isActiveRow,
  isCancelled,
  isCompleted,
  isDraft,
  isInTransit,
  orsisForDelivery,
  progressColor,
  progressLabel,
  progressOf,
  settledAt,
  sortByDate
} from '../composables/useDeliveryProgress'

const asList = (rows) => (Array.isArray(rows) ? rows : [])
const text = value => (value == null ? '' : String(value).trim())

function ageLabel (days) {
  if (!Number.isFinite(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days`
}

function present (rows) {
  return rows.map(row => {
    const age = daysSince(settledAt(row))
    const progress = progressOf(row)
    const itemCount = orsisForDelivery(row).length
    return decorateRow(row, {
      displayDeliveryLabel: text(row.UserName) || text(row.Code),
      displayDeliveryItemCount: itemCount,
      displayDeliveryCaption: [`${itemCount} items`, text(row.Date)].filter(Boolean).join(' • '),
      displayDeliveryAge: ageLabel(age),
      displayDeliveryAgeColor: ageColor(age),
      displayDeliveryProgress: progressLabel(progress),
      displayDeliveryProgressColor: progressColor(progress)
    })
  })
}

function stateRows (rows, matches, direction) {
  return present(sortByDate(
    asList(rows).filter(isActiveRow).filter(matches),
    settledAt,
    direction
  ))
}

function recent (rows) {
  return present(sortByDate(
    asList(rows).filter(isActiveRow).filter((row) => !isCancelled(row)),
    settledAt,
    'desc'
  ))
}

function outlets () {
  const records = useRecord()
  const { skuLabelText } = useSkuResource()

  return buildOutletDeliveryQueue({
    restockItems: records.rows('OutletRestockItems'),
    restocks: records.rows('OutletRestocks'),
    deliveries: records.rows('OutletDeliveries'),
    outlets: records.rows('Outlets'),
    skuLabelText
  })
}

export default {
  default: (rows) => asList(rows),
  Recent: recent,
  Pending: (rows) => stateRows(rows, isDraft, 'asc'),
  InTransit: (rows) => stateRows(rows, isInTransit, 'asc'),
  Outlets: outlets,
  Completed: (rows) => stateRows(rows, isCompleted, 'desc'),
  Cancelled: (rows) => stateRows(rows, isCancelled, 'desc')
}
