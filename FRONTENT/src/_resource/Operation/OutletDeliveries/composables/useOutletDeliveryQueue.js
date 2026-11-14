import { availableAllocatedItems } from './useDeliveryAllocation'
import { ageColor, daysSince, settledAt } from './useDeliveryProgress'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])

export function buildOutletDeliveryQueue ({
  restockItems = [],
  restocks = [],
  deliveries = [],
  outlets = [],
  skuLabelText = (code) => code
} = {}) {
  const restockByCode = new Map()
  const outletByCode = new Map()

  for (const raw of asList(restocks)) {
    const row = asRow(raw)
    const code = text(row.Code)
    if (code) restockByCode.set(code, row)
  }

  for (const raw of asList(outlets)) {
    const row = asRow(raw)
    const code = text(row.Code)
    if (code) outletByCode.set(code, row)
  }

  const groups = new Map()
  for (const row of availableAllocatedItems(restockItems, deliveries)) {
    const parent = restockByCode.get(text(row.OutletRestockCode))
    const outletCode = text(parent?.OutletCode)
    const key = outletCode || '__unresolved'

    if (!groups.has(key)) {
      const outlet = outletByCode.get(outletCode)
      groups.set(key, {
        outletCode,
        outletName: text(outlet?.Name) || outletCode || 'Unresolved outlet',
        city: text(outlet?.City),
        items: []
      })
    }

    const allocatedAt = text(row.ProgressAllocatedAt) || settledAt(parent || {})
    const days = daysSince(allocatedAt)
    groups.get(key).items.push({
      ...row,
      allocatedAt,
      skuLabel: text(skuLabelText(text(row.SKU))) || text(row.SKU),
      quantity: Math.abs(Number(row.Quantity) || 0),
      restockCode: text(row.OutletRestockCode),
      days,
      ageColor: ageColor(days)
    })
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      itemCount: group.items.length,
      unitCount: group.items.reduce((sum, row) => sum + row.quantity, 0),
      oldestDays: group.items.reduce(
        (max, row) => (!Number.isFinite(row.days) ? max : Math.max(Number.isFinite(max) ? max : 0, row.days)), NaN),
      oldestAt: group.items.reduce(
        (oldest, row) => (!Number.isFinite(row.days) ? oldest
          : (!oldest || row.days > oldest.days ? row : oldest)), null)?.allocatedAt || ''
    }))
    .sort((a, b) => (Number.isFinite(b.oldestDays) ? b.oldestDays : -1) -
      (Number.isFinite(a.oldestDays) ? a.oldestDays : -1) || a.outletName.localeCompare(b.outletName))
}
