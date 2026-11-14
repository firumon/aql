/**
 * Outlet rules for the shared ListViews pipeline.
 * Reads Outlets.Code and Status; index order uses Outlets.Name.
 * Stream rules use each stream's OutletCode and Status.
 * Activity dates come from OutletVisits.ProgressCompletedAt/RespondDate,
 * OutletRestocks.UpdatedAt/Date, OutletConsumptions.UpdatedAt/Date,
 * OutletConsumptionInvoices.UpdatedAt/Date, and OutletPayments.UpdatedAt/Date.
 * Recent: keeps blank or Active Status rows, in source order.
 * AllOutlets: uses the same rows as Recent.
 * NoUpdates: maps stale active outlets by Code, with never-touched outlets first.
 * RecentlyRestocked: maps recent restocks by Code, newest first.
 * RecentlyConsumed: maps recent consumptions by Code, newest first.
 * RecentlyPaid: maps recent payments by Code, newest first.
 * RecentlyVisited: maps recent visits by Code, newest first.
 */
import { useOutletIndex } from '../composables/useOutletIndex'
import { decorateRow } from 'src/utils/appHelpers'
import { activityColor, activityLabel, ageInDays, isActiveRow } from '../composables/useOutletActivity'

const text = value => (value == null ? '' : String(value).trim())

function present (rows) {
  return rows.map(row => {
    const lastActivityDays = row.lastActivityDays ?? null
    const restockDays = ageInDays(row.restockAt)
    const consumptionDays = ageInDays(row.consumptionAt)
    const paymentDays = ageInDays(row.paymentAt)
    const visitDays = ageInDays(row.visitAt)

    return decorateRow(row, {
      displayName: text(row.name) || text(row.code),
      displayLocation: [row.province, row.city, row.area].map(text).filter(Boolean).join(' · ') || 'No location recorded',
      displayActivityLabel: activityLabel(lastActivityDays),
      displayActivityStream: row.lastActivityStreamLabel || (lastActivityDays === null ? 'No activity' : ''),
      displayActivityColor: activityColor(lastActivityDays),
      displayRestockAge: activityLabel(restockDays),
      displayRestockColor: activityColor(restockDays),
      displayConsumptionAge: activityLabel(consumptionDays),
      displayConsumptionColor: activityColor(consumptionDays),
      displayPaymentAge: activityLabel(paymentDays),
      displayPaymentColor: activityColor(paymentDays),
      displayVisitAge: activityLabel(visitDays),
      displayVisitColor: activityColor(visitDays)
    })
  })
}

function Recent (rows = []) {
  return present(rows.filter(isActiveRow))
}

function NoUpdates (rows = []) {
  const byCode = new Map(rows.map(row => [row.Code, row]))
  return present(useOutletIndex().views.value.NoUpdates.map(row => byCode.get(row.code)).filter(Boolean))
}

function RecentlyRestocked (rows = []) {
  const byCode = new Map(rows.map(row => [row.Code, row]))
  return present(useOutletIndex().views.value.RecentlyRestocked.map(row => byCode.get(row.code)).filter(Boolean))
}

function RecentlyConsumed (rows = []) {
  const byCode = new Map(rows.map(row => [row.Code, row]))
  return present(useOutletIndex().views.value.RecentlyConsumed.map(row => byCode.get(row.code)).filter(Boolean))
}

function RecentlyPaid (rows = []) {
  const byCode = new Map(rows.map(row => [row.Code, row]))
  return present(useOutletIndex().views.value.RecentlyPaid.map(row => byCode.get(row.code)).filter(Boolean))
}

function RecentlyVisited (rows = []) {
  const byCode = new Map(rows.map(row => [row.Code, row]))
  return present(useOutletIndex().views.value.RecentlyVisited.map(row => byCode.get(row.code)).filter(Boolean))
}

export default { Recent, AllOutlets: Recent, NoUpdates, RecentlyRestocked, RecentlyConsumed, RecentlyPaid, RecentlyVisited }
