import {
  sortByDate, settledAt, daysSince, ageColor, progressOf, progressColor, typeMeta, priorityMeta, isOwnedBy
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'
import { hoursFromNow } from 'src/utils/dateHelpers'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'

const text = (value) => String(value ?? '').trim()

export function requisitionLabel (row) {
  return [text(row?.Code), text(row?.PRDate)].filter(Boolean).join(' / ')
}

export function joinParts (parts) {
  return (parts || []).filter((part) => text(part)).join(' • ')
}

export function ageLabel (value, calendar = false) {
  if (calendar) {
    const days = daysSince(value)
    if (!Number.isFinite(days)) return ''
    if (days <= 0) return 'Today'
    return days === 1 ? 'Yesterday' : `${days} days`
  }
  const elapsed = hoursFromNow(value)
  if (!Number.isFinite(elapsed)) return ''
  const hours = Math.max(0, -elapsed)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  if (days <= 99) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  const months = Math.floor(days / 30)
  return `${months} ${months === 1 ? 'month' : 'months'} ago`
}

function agedPreset (items, { direction, caption, extra = {}, recent = false }) {
  const appearance = recent ? recentPreset(items) : {}
  return {
    ...appearance,
    items: sortByDate(items, settledAt, direction),
    layout: recent ? appearance.layout : ['caption', 'label'],
    content: recent ? appearance.content : null,
    label: recent ? requisitionLabel : 'Code',
    caption,
    metaLayout: ['chip'],
    chip: (row) => ageLabel(settledAt(row)),
    chipColor: (row) => ageColor(daysSince(settledAt(row))),
    chipOutline: true,
    meta: null, badge: null, metaLabel: null, metaCaption: null,
    highlightColor: (row) => progressColor(progressOf(row)),
    ...extra
  }
}

export function updatedAtOrSettled (row) {
  return row?.UpdatedAt || row?.CreatedAt || settledAt(row) || ''
}

export function recentPreset (items) {
  const { getWarehouse } = useWarehouseResource()
  return {
    items: sortByDate(items, updatedAtOrSettled, 'desc'),
    layout: ['caption', 'label', 'caption'],
    content: [
      (row) => joinParts([typeMeta(row.Type).label, getWarehouse(row.WarehouseCode)?.name || row.WarehouseCode, row.Username]),
      requisitionLabel,
      (row) => priorityMeta(row.Priority).label
    ],
    label: requisitionLabel, caption: null,
    metaLayout: ['chip'],
    chip: (row) => progressOf(row),
    chipColor: (row) => progressColor(progressOf(row)),
    chipOutline: true,
    meta: null, badge: null, metaLabel: null, metaCaption: null,
    highlightColor: (row) => progressColor(progressOf(row))
  }
}

export function draftsPreset (items, userId = null) {
  const own = userId ? (Array.isArray(items) ? items : []).filter((row) => isOwnedBy(row, userId)) : items
  return agedPreset(own, {
    direction: 'desc',
    caption: (row) => joinParts([row.PRDate, typeMeta(row.Type).label, priorityMeta(row.Priority).label]),
    extra: { chip: (row) => ageLabel(settledAt(row), true) }
  })
}

export function pendingApprovalPreset (items) {
  const { getWarehouse } = useWarehouseResource()
  return agedPreset(items, {
    direction: 'asc', caption: null,
    extra: {
      layout: ['caption', 'label', 'caption'],
      content: [
        (row) => joinParts([row.PRDate, row.Username]),
        (row) => row.Code,
        (row) => joinParts([getWarehouse(row.WarehouseCode)?.name || row.WarehouseCode,
          typeMeta(row.Type).label, priorityMeta(row.Priority).label])
      ]
    }
  })
}

export function needsRevisionPreset (items) {
  return agedPreset(items, {
    direction: 'asc',
    caption: (row) => joinParts([row.PRDate, typeMeta(row.Type).label, priorityMeta(row.Priority).label])
  })
}

export function approvedPreset (items) {
  return agedPreset(items, { direction: 'asc', recent: true, extra: { btn: null } })
}

export function rfqProcessedPreset (items) {
  return agedPreset(items, { direction: 'desc', recent: true, extra: { btn: null } })
}

export function rejectedPreset (items) {
  return agedPreset(items, { direction: 'desc', recent: true, extra: { btn: null } })
}

export function usePurchaseRequisitionRowPresets () {
  return {
    requisitionLabel, joinParts, ageLabel, updatedAtOrSettled, recentPreset, draftsPreset,
    pendingApprovalPreset, needsRevisionPreset, approvedPreset, rfqProcessedPreset, rejectedPreset
  }
}
