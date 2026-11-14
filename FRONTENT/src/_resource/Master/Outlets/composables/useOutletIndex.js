import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useOutletResource } from './useOutletResource'
import { operatingRuleDefaults } from 'src/_resource/Master/OutletOperatingRules/composables/useOutletOperatingRulesResource'
import { useOutletStorageResource } from 'src/_resource/Operation/OutletStorages/composables/useOutletStorageResource'
import { toDateOnly } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'
import {
  VISIT_WINDOW_DAYS,
  ACTIVITY_WINDOW_DAYS,
  ACTIVITY_STREAMS,
  ageInDays,
  withinPastDays,
  withinNextDays,
  isActiveRow,
  isActiveOutlet
} from './useOutletActivity'
import {
  PENDING_APPROVAL as RESTOCK_PENDING_APPROVAL,
  AWAITING_DELIVERY as RESTOCK_AWAITING_DELIVERY
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'
import {
  PENDING_INVOICE_GENERATION,
  recentConsumptionForOutlet
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'
import { PLANNED as VISIT_PLANNED, COMPLETED as VISIT_COMPLETED } from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const upper = (value) => text(value).toUpperCase()

function groupByOutlet (rows, column = 'OutletCode') {
  const map = new Map()
  for (const row of rows) {
    const code = text(row[column])
    if (!code) continue
    const bucket = map.get(code)
    if (bucket) bucket.push(row)
    else map.set(code, [row])
  }
  return map
}

const todayISO = () => new Date().toISOString().slice(0, 10)

function latestDate (rows, column, fallbackColumn) {
  const today = todayISO()
  let latest = ''
  for (const row of rows) {
    const raw = (row[column] != null && row[column] !== '')
      ? row[column]
      : (fallbackColumn ? row[fallbackColumn] : '')
    const value = toDateOnly(raw)
    if (value && value <= today && value > latest) latest = value
  }
  return latest
}

function distinctOutlets (rows) {
  const seen = new Set()
  for (const row of rows) {
    const code = text(row.OutletCode)
    if (code) seen.add(code)
  }
  return seen.size
}

const build = (recordSource) => {
  const { outlets, activeOutlets, outletMap } = useOutletResource()
  const noUpdatesDays = computed(() => operatingRuleDefaults().visitFrequencyDays)

  const rows = (name) => (recordSource.rows(name) || []).map(asRow).filter(isActiveRow)

  const rawVisits = computed(() => rows('OutletVisits'))
  const rawRestocks = computed(() => rows('OutletRestocks'))
  const rawConsumptions = computed(() => rows('OutletConsumptions'))
  const rawInvoices = computed(() => rows('OutletConsumptionInvoices'))
  const rawPayments = computed(() => rows('OutletPayments'))
  const rawReturns = computed(() => rows('OutletReturns'))

  const { rawStorages, rowsByOutlet: storagesByOutlet, stockRowsOf } = useOutletStorageResource()

  const visitsByOutlet = computed(() => groupByOutlet(rawVisits.value))
  const restocksByOutlet = computed(() => groupByOutlet(rawRestocks.value))
  const consumptionsByOutlet = computed(() => groupByOutlet(rawConsumptions.value))
  const invoicesByOutlet = computed(() => groupByOutlet(rawInvoices.value))
  const paymentsByOutlet = computed(() => groupByOutlet(rawPayments.value))
  const returnsByOutlet = computed(() => groupByOutlet(rawReturns.value))

  const childOutletsByParent = computed(() => {
    const map = new Map()
    for (const outlet of outlets.value) {
      const parent = text(outlet.ParentOutletCode ?? outlet.parentOutletCode)
      if (!parent) continue
      const bucket = map.get(parent)
      if (bucket) bucket.push(outlet)
      else map.set(parent, [outlet])
    }
    return map
  })

  const childOutletsFor = (code) => childOutletsByParent.value.get(text(code)) || []

  const motherOutlets = computed(() =>
    outlets.value.filter((outlet) => childOutletsFor(outlet.Code || outlet.code).length > 0))

  const isMother = (code) => childOutletsFor(code).length > 0

  const familyCodesFor = (code) => {
    const self = text(code)
    const children = childOutletsFor(self).map((outlet) => text(outlet.Code || outlet.code))
    return [self, ...children]
  }

  const streamMaps = computed(() => ({
    visit: visitsByOutlet.value,
    restock: restocksByOutlet.value,
    consumption: consumptionsByOutlet.value,
    invoice: invoicesByOutlet.value,
    payment: paymentsByOutlet.value
  }))

  const outletSummaries = computed(() => {
    const maps = streamMaps.value

    return outlets.value.map((outlet) => {
      const code = outlet.code
      const streams = {}
      let lastActivityAt = ''

      for (const stream of ACTIVITY_STREAMS) {
        if (stream.key === 'consumption') {
          const res = recentConsumptionForOutlet(code, maps.consumption)
          streams.consumption = { count: res.count, lastAt: res.lastAt }
          if (res.lastAt && res.lastAt > lastActivityAt) lastActivityAt = res.lastAt
          continue
        }
        const streamRows = (maps[stream.key]?.get(code) || []).filter((row) => {
          const progress = upper(row.Progress)
          if (progress === 'CANCELLED' || progress === 'REJECTED') return false
          if (stream.key === 'visit') return progress === VISIT_COMPLETED
          return true
        })
        const last = latestDate(streamRows, stream.dateColumn, stream.fallbackDateColumn)
        streams[stream.key] = { count: streamRows.length, lastAt: last }
        if (last && last > lastActivityAt) lastActivityAt = last
      }

      const latestStreams = lastActivityAt
        ? ACTIVITY_STREAMS.filter((stream) => streams[stream.key]?.lastAt === lastActivityAt)
        : []
      const lastActivityStream = latestStreams.map((stream) => stream.key).join(', ')
      const lastActivityStreamLabel = latestStreams.map((stream) => stream.label).join(', ')

      const summary = {
        outlet,
        code,
        name: outlet.name || code,
        province: outlet.province,
        city: outlet.city,
        area: outlet.area,
        status: outlet.status,
        streams,
        lastActivityAt,
        lastActivityDays: ageInDays(lastActivityAt),
        lastActivityStream,
        lastActivityStreamLabel,

        search: [
          code,
          outlet.name,
          outlet.province,
          outlet.city,
          outlet.area,
          outlet.contactPerson,
          outlet.phone,
          outlet.email
        ].map(text).filter(Boolean).join(' ').toLowerCase()
      }

      summary.isActive = isActiveOutlet(summary)
      return summary
    })
  })

  const summaryByCode = computed(() =>
    new Map(outletSummaries.value.map((summary) => [summary.code, summary])))

  const activeSummaries = computed(() =>
    outletSummaries.value.filter((summary) => upper(summary.status) === 'ACTIVE'))

  const totalsMetrics = computed(() => ({
    total: outlets.value.length,
    active: activeOutlets.value.length,
    inactive: outlets.value.length - activeOutlets.value.length
  }))

  function countBy (key) {
    const counts = new Map()
    for (const summary of activeSummaries.value) {
      const value = text(summary[key])
      if (!value) continue
      counts.set(value, (counts.get(value) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }

  const geography = computed(() => ({
    province: countBy('province'),
    city: countBy('city'),
    area: countBy('area')
  }))

  const pendingRestockRows = computed(() =>
    rawRestocks.value.filter((row) => upper(row.Progress) === RESTOCK_PENDING_APPROVAL))

  const pendingDeliveryRows = computed(() =>
    rawRestocks.value.filter((row) => RESTOCK_AWAITING_DELIVERY.includes(upper(row.Progress))))

  const pendingInvoiceRows = computed(() =>
    rawConsumptions.value.filter((row) => upper(row.Progress) === PENDING_INVOICE_GENERATION))

  const pendingMetrics = computed(() => ({
    restockOutlets: distinctOutlets(pendingRestockRows.value),
    restockRequests: pendingRestockRows.value.length,
    deliveryOutlets: distinctOutlets(pendingDeliveryRows.value),
    deliveryRequests: pendingDeliveryRows.value.length,
    invoiceOutlets: distinctOutlets(pendingInvoiceRows.value),
    invoiceConsumptions: pendingInvoiceRows.value.length
  }))

  const recentVisitRows = computed(() =>
    rawVisits.value.filter((row) =>
      upper(row.Progress) === VISIT_COMPLETED && withinPastDays(row.Date, VISIT_WINDOW_DAYS)))

  const upcomingVisitRows = computed(() =>
    rawVisits.value.filter((row) =>
      upper(row.Progress) === VISIT_PLANNED && withinNextDays(row.Date, VISIT_WINDOW_DAYS)))

  const visitMetrics = computed(() => ({
    windowDays: VISIT_WINDOW_DAYS,
    recentVisits: recentVisitRows.value.length,
    recentOutlets: distinctOutlets(recentVisitRows.value),
    upcomingVisits: upcomingVisitRows.value.length,
    upcomingOutlets: distinctOutlets(upcomingVisitRows.value)
  }))

  const activityMetrics = computed(() => {
    const total = activeSummaries.value.length
    const active = activeSummaries.value.filter((summary) => summary.isActive).length
    return {
      windowDays: ACTIVITY_WINDOW_DAYS,
      total,
      active,
      stale: total - active,
      ratio: total > 0 ? active / total : 0
    }
  })

  const byName = (a, b) => a.name.localeCompare(b.name)
  const byStreamDesc = (key) => (a, b) =>
    text(b.streams[key].lastAt).localeCompare(text(a.streams[key].lastAt)) || byName(a, b)

  const recentlyIn = (key) => activeSummaries.value
    .filter((summary) => withinPastDays(summary.streams[key].lastAt, ACTIVITY_WINDOW_DAYS))
    .sort(byStreamDesc(key))

  const views = computed(() => ({
    Recent: sortByDate([...activeSummaries.value].sort(byName), 'lastActivityAt', 'desc'),
    AllOutlets: [...activeSummaries.value].sort(byName),

    NoUpdates: activeSummaries.value
      .filter((summary) => noUpdatesDays.value > 0 &&
        (summary.lastActivityDays === null || summary.lastActivityDays > noUpdatesDays.value))
      .sort((a, b) => {
        const left = a.lastActivityDays
        const right = b.lastActivityDays
        if (left === null && right === null) return byName(a, b)
        if (left === null) return -1
        if (right === null) return 1
        return right - left || byName(a, b)
      }),

    RecentlyRestocked: recentlyIn('restock'),
    RecentlyConsumed: recentlyIn('consumption'),
    RecentlyPaid: recentlyIn('payment'),
    RecentlyVisited: recentlyIn('visit')
  }))

  const sortedFor = (map, code, column) =>
    [...(map.get(text(code)) || [])].sort((a, b) => text(b[column]).localeCompare(text(a[column])))

  const sortedFamilyFor = (map, code, column) => {
    const rows = []
    for (const familyCode of familyCodesFor(code)) {
      const list = map.get(familyCode)
      if (list) rows.push(...list)
    }
    return rows.sort((a, b) => text(b[column]).localeCompare(text(a[column])))
  }

  const familyVisitsFor = (code) => sortedFamilyFor(visitsByOutlet.value, code, 'Date')
  const familyRestocksFor = (code) => sortedFamilyFor(restocksByOutlet.value, code, 'Date')
  const familyConsumptionsFor = (code) => sortedFamilyFor(consumptionsByOutlet.value, code, 'Date')
  const familyInvoicesFor = (code) => sortedFamilyFor(invoicesByOutlet.value, code, 'Date')
  const familyPaymentsFor = (code) => sortedFamilyFor(paymentsByOutlet.value, code, 'Date')
  const familyReturnsFor = (code) => sortedFamilyFor(returnsByOutlet.value, code, 'Date')
  const familyStockFor = (code) => familyCodesFor(code).flatMap((familyCode) => stockRowsOf(familyCode))

  return {
    rawVisits,
    rawRestocks,
    rawConsumptions,
    rawInvoices,
    rawPayments,
    rawReturns,
    rawStorages,

    outletMap,
    visitsByOutlet,
    restocksByOutlet,
    consumptionsByOutlet,
    invoicesByOutlet,
    paymentsByOutlet,
    returnsByOutlet,
    storagesByOutlet,

    childOutletsByParent,
    motherOutlets,
    isMother,
    childOutletsFor,
    familyCodesFor,

    outletSummaries,
    summaryByCode,
    activeSummaries,

    totalsMetrics,
    geography,
    pendingMetrics,
    visitMetrics,
    activityMetrics,

    pendingRestockRows,
    pendingDeliveryRows,
    pendingInvoiceRows,
    recentVisitRows,
    upcomingVisitRows,
    views,

    summaryFor: (code) => summaryByCode.value.get(text(code)) || null,
    visitsFor: (code) => sortedFor(visitsByOutlet.value, code, 'Date'),
    restocksFor: (code) => sortedFor(restocksByOutlet.value, code, 'Date'),
    consumptionsFor: (code) => sortedFor(consumptionsByOutlet.value, code, 'Date'),
    invoicesFor: (code) => sortedFor(invoicesByOutlet.value, code, 'Date'),
    paymentsFor: (code) => sortedFor(paymentsByOutlet.value, code, 'Date'),
    returnsFor: (code) => sortedFor(returnsByOutlet.value, code, 'Date'),
    stockFor: (code) => stockRowsOf(code),

    familyVisitsFor,
    familyRestocksFor,
    familyConsumptionsFor,
    familyInvoicesFor,
    familyPaymentsFor,
    familyReturnsFor,
    familyStockFor
  }
}

export function useOutletIndex () {
  const recordSource = useRecord()
  return recordSource.remember('useOutletIndex', () => build(recordSource))
}
