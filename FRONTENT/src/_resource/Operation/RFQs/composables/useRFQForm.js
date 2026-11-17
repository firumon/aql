import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { batchRef } from 'src/utils/appHelpers'
import { useAuth } from 'src/composables/core/useAuth'
import { useRFQRequirements, buildRFQRequirementsNodes, validateRFQRequirementsNodes } from './useRFQRequirements'
import {
  buildRFQInitNodes, buildRFQEditInitNodes, buildRFQRecord, buildRFQSaveChainNodes, buildRFQItemRecords
} from './useRFQPayload'
import { isEditable, isActiveRow } from './useRFQProgress'
import { useRFQResource } from './useRFQResource'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import {
  buildProcurementCreateNode, PROCUREMENT_REF_PATH
} from 'src/_resource/Operation/Procurements/composables/useProcurementPayload'
import { RFQ_GENERATED } from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import { useSupplierResource } from 'src/_resource/Master/Suppliers/composables/useSupplierResource'

const RESOURCE = 'RFQs'
const ITEMS_RESOURCE = 'RFQItems'
const text = (value) => String(value ?? '').trim()
const codesOf = (value) => [...new Set((Array.isArray(value) ? value : text(value).split(',')).map(text).filter(Boolean))]

function sourceInputs (record, previousItems = []) {
  const reader = usePurchaseRequisitionResource()
  const selected = new Set(codesOf(record.PurchaseRequisitionCodes ?? record.PurchaseRequisitionCode))
  for (const row of previousItems) {
    let allocations = row.Allocations || {}
    if (typeof allocations === 'string') {
      try { allocations = JSON.parse(allocations) } catch { allocations = {} }
    }
    for (const code of Object.keys(allocations || {})) {
      if (code === 'excess') continue
      const item = reader.getRequisitionItem(code)
      if (item?.PurchaseRequisitionCode) selected.add(text(item.PurchaseRequisitionCode))
    }
  }
  return {
    requisitions: [...selected].map(reader.getPurchaseRequisition).filter(Boolean),
    prItems: [...selected].flatMap((code) => reader.itemsByRequisition.value.get(code) || []),
    loading: Boolean(reader.loading?.value)
  }
}

export function validateRFQDraftNodes ({
  record = {}, original = null, items = null, rfqItems = null, suppliers = [], stage = 'all',
  requirementId = '', criterionId = '', directItems = []
} = {}) {
  const reader = useRFQRequirements()
  if (original && !isEditable(original)) return [{ valid: false, message: 'Only a draft or assigned RFQ can be edited.' }]
  if (['all', 'basics'].includes(stage) && (!reader.validDate(record.RFQDate) || !reader.validDate(record.QuotationSubmissionDeadline) ||
    record.QuotationSubmissionDeadline < record.RFQDate)) {
    return [{ valid: false, message: 'Use valid dates. The deadline must be on or after the RFQ date.' }]
  }
  if (stage === 'all' || stage === 'basics') {
    if (!reader.validDate(record.RequiredBy) || record.RequiredBy < record.RFQDate) {
      return [{ valid: false, message: 'Set a valid Required By date on or after the RFQ date.' }]
    }
  }
  if (['all', 'basics'].includes(stage) && (!text(record.WarehouseCode) || !['STOCK', 'PROJECT', 'SALES', 'ASSET'].includes(record.Type) ||
    !['Low', 'Medium', 'High', 'Urgent'].includes(record.Priority) || !text(record.Username))) {
    return [{ valid: false, message: 'Set the warehouse, type, priority, and username.' }]
  }
  const requirements = validateRFQRequirementsNodes({
    record, original: original || {}, requirementId: requirementId || criterionId,
    namesOnly: ['source', 'items', 'requirements', 'criteria', 'basics', 'suppliers'].includes(stage)
  })
  if (!['items', 'source', 'basics'].includes(stage) && requirements.length) return requirements
  const rows = items ?? rfqItems ?? (directItems.length ? directItems.map((row) => ({
    SKU: row.sku, Quantity: row.quantity, Status: 'Active'
  })) : useRFQResource().itemsByRfq.value.get(text(original?.Code || record.Code)) || [])
  if (!Array.isArray(rows)) return [{ valid: false, message: 'Pass RFQ items as a list.' }]
  const active = rows.filter((row) => row && isActiveRow(row) && row._action !== 'deactivate')
  if (!active.length) return [{ valid: false, message: 'Add at least one item to quote.' }]
  if (active.some((row) => typeof row.SKU !== 'string' || !text(row.SKU) ||
    !['number', 'string'].includes(typeof row.Quantity) || !Number.isFinite(Number(row.Quantity)) || Number(row.Quantity) <= 0) ||
    new Set(active.map((row) => text(row.SKU))).size !== active.length) {
    return [{ valid: false, message: 'Use a different SKU and a quantity above zero for each item.' }]
  }
  if (!Array.isArray(suppliers)) return [{ valid: false, message: 'Pass suppliers as a list.' }]
  if (suppliers.length) {
    const allowed = new Set(useSupplierResource().activeChoices.value.map((row) => row.code))
    if (suppliers.some((code) => !allowed.has(text(code)))) return [{ valid: false, message: 'Choose active suppliers only.' }]
  }
  return []
}

export function syncRFQDraftNodes ({
  record = {}, original = null, items = null, rfqItems = null, previousItems = null,
  requisitions = null, prItems = null, suppliers = [], directItems = [], prCodes
} = {}) {
  const reader = useRFQResource()
  const saved = previousItems ?? reader.itemsByRfq.value.get(text(original?.Code)) ?? []
  const rows = items ?? rfqItems ?? (directItems.length ? directItems.map((row) => ({
    SKU: row.sku, Quantity: row.quantity, UOM: row.uom, Description: row.description, Status: 'Active'
  })) : saved)
  const header = buildRFQRecord({ form: { ...record,
    PurchaseRequisitionCodes: codesOf(prCodes ?? record.PurchaseRequisitionCodes ?? record.PurchaseRequisitionCode).join(',')
  } })
  const inputs = requisitions && prItems ? { requisitions, prItems } : sourceInputs(header, saved)
  const { user } = useAuth()
  const chain = buildRFQSaveChainNodes({
    ...inputs, ...(requisitions ? { requisitions } : {}), ...(prItems ? { prItems } : {}),
    rfq: original, form: header, items: rows, previousItems: saved, suppliers,
    existingSupplierRows: original ? reader.suppliersOf(original.Code) : [], prCodes: header.PurchaseRequisitionCodes,
    actorName: text(user.value?.name), actorRole: text(user.value?.role)
  })
  if (!chain.some((node) => node.valid === false)) {
    chain.find(node => node.resource === RESOURCE).controls = { DraftError: '' }
    return chain
  }
  return [{
    resource: RESOURCE, ...(original?.Code ? { code: original.Code } : {}), record: header,
    controls: { DraftError: chain.find(node => node.valid === false)?.message || '' },
    children: [{ resource: ITEMS_RESOURCE, records: buildRFQItemRecords(rows) }],
    permissions: original ? { update: 'You are not allowed to update this RFQ.' } : { create: 'You are not allowed to create an RFQ.' }
  }]
}

function refreshDraft (api, original, previousItems) {
  const record = api.getRecord(null, RESOURCE) || {}
  const nodes = syncRFQDraftNodes({
    record, original, previousItems, items: api.getChildRows(ITEMS_RESOURCE, RESOURCE),
    suppliers: api.getControls('SelectedSupplierCodes', [], RESOURCE)
  })
  const primary = nodes.find((node) => node.resource === RESOURCE)
  const nextProgress = primary?.record?.Progress
  const nextError = primary?.controls?.DraftError || ''
  if (nextProgress !== api.getRecord('Progress', RESOURCE)) api.setRecord('Progress', nextProgress, RESOURCE)
  if (nextError !== api.getControls('DraftError', '', RESOURCE)) api.setControls('DraftError', nextError, RESOURCE)
  if (!nextError) {
    const computedRows = new Map((primary?.children?.find((bucket) => bucket.resource === ITEMS_RESOURCE)?.records || [])
      .filter((row) => row._action !== 'deactivate').map((row) => [row.SKU, row]))
    api.getChildRows(ITEMS_RESOURCE, RESOURCE).forEach((row, index) => {
      if (row._action === 'deactivate') return
      const next = computedRows.get(row.SKU)
      if (next && (row.Allocations !== next.Allocations || row.PurchaseRequisitionItemCodes !== next.PurchaseRequisitionItemCodes)) {
        api.updateChild(ITEMS_RESOURCE, index, {
          Allocations: next.Allocations, PurchaseRequisitionItemCodes: next.PurchaseRequisitionItemCodes
        }, RESOURCE)
      }
    })
  }
  const secondary = nodes.filter((node) => ['RFQSuppliers', 'Procurements'].includes(node.resource) ||
    ['PurchaseRequisitions', 'PurchaseRequisitionItems'].includes(node.resource) && node.role === 'rfqAllocation')
  const present = new Set(secondary.map((node) => node.resource + ':' + (node.role || '$default')))
  for (const [resource, role] of [
    ['RFQSuppliers', '$default'], ['Procurements', '$default'],
    ['PurchaseRequisitions', 'rfqAllocation'], ['PurchaseRequisitionItems', 'rfqAllocation']
  ]) if (!present.has(resource + ':' + role) && api.hasNode(resource, role)) api.removeNode(resource, role)
  if (api.state.reload.length) api.setReload([])
  const changed = secondary.filter((node) => {
    if (!api.hasNode(node.resource, node.role)) return true
    const live = api.useNode(node.resource, node.role).node.value
    return JSON.stringify(live.record || {}) !== JSON.stringify(node.record || {}) ||
      JSON.stringify(live.records || []) !== JSON.stringify(node.records || []) ||
      JSON.stringify(live.children || []) !== JSON.stringify(node.children || [])
  })
  if (changed.length) api.applyNodes(changed)
}

export function buildRFQFormInitNodes ({ rfq = null, items = null } = {}) {
  const reader = useRFQResource()
  const saved = rfq ? reader.itemsByRfq.value.get(text(rfq.Code)) || [] : []
  const nodes = rfq ? buildRFQEditInitNodes(rfq) : buildRFQInitNodes()
  if (nodes[0]?.valid === false) return nodes
  const primary = nodes[0]
  const requirements = useRFQRequirements()
  if (!rfq) for (const definition of requirements.catalogue.value.filter((entry) => entry.selected === true)) {
    const selected = buildRFQRequirementsNodes({
      record: primary.record, operation: 'select', id: definition.column, catalogue: requirements.catalogue.value
    })
    if (!selected.some((node) => node.valid === false)) Object.assign(primary.record, selected[0].record)
  }
  primary.children = [{ resource: ITEMS_RESOURCE, records: buildRFQItemRecords(items ?? saved) }]
  const contributions = {}
  const requisitions = usePurchaseRequisitionResource()
  for (const item of saved) {
    let allocations = item.Allocations || {}
    if (typeof allocations === 'string') {
      try { allocations = JSON.parse(allocations) } catch { allocations = {} }
    }
    for (const [code, quantity] of Object.entries(allocations)) {
      const pr = requisitions.getRequisitionItem(code)?.PurchaseRequisitionCode
      if (!pr) continue
      contributions[pr] ||= {}
      contributions[pr][item.SKU] = (contributions[pr][item.SKU] || 0) + Number(quantity || 0)
    }
  }
  primary.controls = { SelectedSupplierCodes: [], PrContributions: contributions }
  primary.derive = [
    { key: 'rfq:prSelection', on: { resource: RESOURCE, record: 'PurchaseRequisitionCodes' }, immediate: false,
      handler: (value, api, previous) => {
        const before = new Set(codesOf(previous))
        const after = new Set(codesOf(value))
        const contributions = { ...api.getControls('PrContributions', {}, RESOURCE) }
          const childRows = api.getChildRows(ITEMS_RESOURCE, RESOURCE)
          const removedCodes = childRows.filter((row) => row?._action === 'deactivate' && text(row.Code))
            .map((row) => text(row.Code))
          const rows = new Map(childRows.filter((row) => row._action !== 'deactivate')
            .map((row) => [row.SKU, { ...row }]))
        for (const code of before) {
          if (after.has(code)) continue
          for (const [sku, quantity] of Object.entries(contributions[code] || {})) {
            const row = rows.get(sku)
            if (!row) continue
            row.Quantity = Number(row.Quantity) - quantity
              if (row.Quantity <= 0) {
                if (text(row.Code)) removedCodes.push(text(row.Code))
                rows.delete(sku)
              }
          }
          delete contributions[code]
        }
        const skus = useSkuResource()
        for (const code of after) {
          if (before.has(code)) continue
          contributions[code] = {}
          for (const item of requisitions.linesByRequisition.value.get(code) || []) {
            const quantity = Math.max(0, item.quantity - item.quotedQuantity)
            if (!quantity) continue
            const row = rows.get(item.SKU) || { SKU: item.SKU, Quantity: 0,
              UOM: skus.skuLabelOf(item.SKU).uom, Description: item.Description || '', Status: 'Active' }
            row.Quantity = Number(row.Quantity) + quantity
            rows.set(item.SKU, row)
            contributions[code][item.SKU] = (contributions[code][item.SKU] || 0) + quantity
          }
        }
        api.setControls('PrContributions', contributions, RESOURCE)
        api.applyNodes([{ resource: RESOURCE, merge: true,
            children: [{ resource: ITEMS_RESOURCE, records: buildRFQItemRecords([...rows.values()], removedCodes) }] }])
      } },
    { key: 'rfq:record', on: { resource: RESOURCE, record: true }, immediate: false,
      handler: (value, api) => refreshDraft(api, rfq, saved) },
    { key: 'rfq:items', on: { resource: RESOURCE, children: ITEMS_RESOURCE }, immediate: false,
      handler: (value, api) => refreshDraft(api, rfq, saved) },
    { key: 'rfq:suppliers', on: { resource: RESOURCE, control: 'SelectedSupplierCodes' }, immediate: false,
      handler: (value, api) => refreshDraft(api, rfq, saved) }
  ]
  if (!rfq) {
    const { user } = useAuth()
    primary.record.ProcurementCode = batchRef(PROCUREMENT_REF_PATH)
    nodes.unshift(buildProcurementCreateNode({
      progress: RFQ_GENERATED, actorName: text(user.value?.name), actorRole: text(user.value?.role)
    }))
  }
  return nodes
}
