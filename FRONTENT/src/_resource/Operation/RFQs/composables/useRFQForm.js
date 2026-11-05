import { findResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useAuth } from 'src/composables/core/useAuth'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { useRFQCriteria, buildRFQCriteriaNodes, validateRFQCriteriaNodes } from './useRFQCriteria'
import { buildRFQInitNodes, buildRFQEditInitNodes, buildRFQRecord, buildRFQCreateChainNodes } from './useRFQPayload'
import { isDraft } from './useRFQProgress'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { isRfqEligible } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'
import { useProcurementResource } from 'src/_resource/Operation/Procurements/composables/useProcurementResource'
import { useSupplierResource } from 'src/_resource/Master/Suppliers/composables/useSupplierResource'

const RESOURCE = 'RFQs'
const SECONDARY = ['RFQSuppliers', 'PurchaseRequisitions', 'Procurements']
const text = (value) => String(value ?? '').trim()

function sourceInputs (record) {
  const { getPurchaseRequisition, linesByRequisition, loading } = usePurchaseRequisitionResource()
  const { getProcurement } = useProcurementResource()
  const requisition = getPurchaseRequisition(record.PurchaseRequisitionCode)
  return {
    requisition, items: linesByRequisition.value.get(text(record.PurchaseRequisitionCode)) || [],
    procurement: getProcurement(requisition?.ProcurementCode), loading: Boolean(loading?.value)
  }
}

export function validateRFQDraftNodes ({ record = {}, original = null, suppliers = [], stage = 'all', criterionId = '', sourceType = 'PR', directItems = [] } = {}) {
  const reader = useRFQCriteria()
  if (original && !isDraft(original)) return [{ valid: false, message: 'Only a draft RFQ can be edited.' }]
  if (!findResourceConfig(RESOURCE)?.headers?.includes('QuotationSubmissionDeadline')) {
    return [{ valid: false, message: 'RFQ sheet setup is still pending. QuotationSubmissionDeadline must be loaded before saving.' }]
  }
  const validateDates = !(original && stage === 'criteria')
  if (validateDates && (!reader.validDate(record.RFQDate) || !reader.validDate(record.QuotationSubmissionDeadline))) {
    return [{ valid: false, message: 'Enter a valid RFQ date and quotation submission deadline.' }]
  }
  if (validateDates && record.QuotationSubmissionDeadline < record.RFQDate) {
    return [{ valid: false, message: 'The quotation submission deadline must be on or after the RFQ date.' }]
  }
  const criteria = validateRFQCriteriaNodes({ record, original: original || {}, criterionId,
    namesOnly: ['source', 'items', 'criteria', 'basics', 'suppliers'].includes(stage) })
  if (criteria.length) return criteria
  if (!original && sourceType === 'DIRECT') {
    if (stage !== 'source') {
      const items = Array.isArray(directItems) ? directItems : []
      if (!items.length) return [{ valid: false, message: 'Add at least one SKU to quote.' }]
      if (items.some((item) => !text(item?.sku) || !Number.isFinite(Number(item?.quantity)) || !(Number(item.quantity) > 0))) {
        return [{ valid: false, message: 'Enter a valid quantity greater than zero for each item.' }]
      }
    }
  } else {
    const { requisition, items, loading } = sourceInputs(record)
    if (loading) return [{ valid: false, message: 'Wait for the requisition items to finish loading.' }]
    if (!requisition || !original && !isRfqEligible(requisition)) return [{ valid: false, message: 'Select an approved purchase requisition.' }]
    if (!items.length) return [{ valid: false, message: 'The selected requisition has no active items to quote.' }]
  }
  if (!original && ['suppliers', 'all'].includes(stage)) {
    const { activeChoices } = useSupplierResource()
    const active = new Set(activeChoices.value.map((row) => row.code))
    if (suppliers.some((code) => !active.has(code))) return [{ valid: false, message: 'Choose active suppliers only.' }]
  }
  return []
}

export function syncRFQDraftNodes ({ record = {}, original = null, suppliers = [], sourceType = 'PR', directItems = [] } = {}) {
  const direct = !original && sourceType === 'DIRECT'
  const inputs = direct ? { requisition: {}, items: [], procurement: null } : sourceInputs(record)
  const form = direct ? {
    ...record,
    PurchaseRequisitionCode: '',
    ProcurementCode: ''
  } : record
  const header = buildRFQRecord({ ...inputs, form })
  const primary = {
    resource: RESOURCE, ...(original?.Code ? { code: original.Code } : {}), record: header,
    permissions: original ? { update: 'You are not allowed to update this RFQ.' } : { create: 'You are not allowed to create an RFQ.' },
    successMsg: original ? 'RFQ updated.' : 'RFQ generated.'
  }
  if (direct) {
    const placeholders = [
      { resource: 'Procurements', record: {} },
      { resource: 'PurchaseRequisitions', record: {} }
    ]
    if (validateRFQDraftNodes({ record: header, suppliers, sourceType, directItems }).length) {
      return [...placeholders, primary]
    }
    const { user } = useAuth()
    const actorName = text(user.value?.name || user.value?.email)
    const directNodes = buildRFQCreateChainNodes({
      form: header,
      suppliers,
      sourceType,
      directItems,
      warehouseCode: text(useWarehouseResource().mainWarehouse.value?.code),
      actorName,
      actorRole: text(user.value?.role)
    })
    return directNodes.some((node) => node.valid === false)
      ? [...placeholders, primary, ...directNodes]
      : directNodes
  }
  if (original || validateRFQDraftNodes({ record: header, suppliers, sourceType, directItems }).length) return [primary]
  return buildRFQCreateChainNodes({ ...inputs, form: header, suppliers })
}

function refreshDraft (api, original, sourceType = 'PR') {
  const record = api.getRecord(null, RESOURCE) || {}
  const suppliers = api.getControls('SelectedSupplierCodes', [], RESOURCE)
  const directItems = api.getControls('DirectItems', [], RESOURCE)
  const nodes = syncRFQDraftNodes({ record, original, suppliers, sourceType, directItems })
  const present = new Set(nodes.map((node) => node.resource))
  for (const name of SECONDARY) if (!present.has(name)) api.removeNode(name)
  api.setReload(nodes.flatMap((node) => node.resource === '$batch' ? node.reload || [] : []))
  const changed = nodes.filter((node) => {
    if (node.resource === '$batch') return true
    const live = api.useNode(node.resource).node.value
    const liveRecord = live.record || {}
    const nextRecord = node.record || {}
    const recordChanged = [...new Set([...Object.keys(liveRecord), ...Object.keys(nextRecord)])]
      .some((key) => JSON.stringify(liveRecord[key]) !== JSON.stringify(nextRecord[key]))
    return recordChanged ||
      JSON.stringify(live.records || []) !== JSON.stringify(node.records || []) ||
      JSON.stringify(live.children || []) !== JSON.stringify(node.children || [])
  })
  if (changed.length) api.applyNodes(changed)
}

export function buildRFQFormInitNodes ({ rfq = null } = {}) {
  const nodes = rfq ? buildRFQEditInitNodes(rfq) : buildRFQInitNodes()
  if (nodes[0]?.valid === false) return nodes
  const primary = nodes.find((node) => node.resource === RESOURCE)
  const reader = useRFQCriteria()
  if (!rfq) {
    for (const definition of reader.catalogue.value.filter((entry) => entry.selected === true)) {
      const selected = buildRFQCriteriaNodes({ record: primary.record, operation: 'select', id: definition.column,
        catalogue: reader.catalogue.value })
      if (!selected.some((node) => node.valid === false)) Object.assign(primary.record, selected[0].record)
    }
  }
  const prConfig = findResourceConfig('PurchaseRequisitions')
  const prAllowed = Boolean(prConfig && prConfig.permissions?.canRead)
  const prepared = rfq
    ? syncRFQDraftNodes({ record: nodes[0].record, original: rfq, sourceType: 'PR' })
    : [
        { resource: 'Procurements', record: {} },
        { resource: 'PurchaseRequisitions', record: {} },
        ...nodes
      ]
  const rfqNode = prepared.find((node) => node.resource === RESOURCE)
  rfqNode.controls = {
    SourceType: prAllowed || rfq ? 'PR' : 'DIRECT',
    DirectItems: [],
    PrListCollapsed: false,
    SelectedSupplierCodes: []
  }
  rfqNode.derive = [{
    key: 'rfq:source', on: { resource: RESOURCE, control: 'SourceType' }, immediate: false,
    handler: (value, api, previous) => {
      if (value === previous || rfq) return
      api.setControls('DirectItems', [], RESOURCE)
      api.setControls('PrListCollapsed', false, RESOURCE)
      api.removeNode('PurchaseRequisitionItems')
      api.setRecord(null, {
        PurchaseRequisitionCode: '',
        ProcurementCode: ''
      }, RESOURCE)
      refreshDraft(api, rfq, value)
    }
  }, {
    key: 'rfq:requisition', on: { resource: RESOURCE, record: 'PurchaseRequisitionCode' }, immediate: false,
    handler: (value, api, previous) => {
      if (value === previous || rfq || api.getControls('SourceType', 'PR', RESOURCE) === 'DIRECT') return
      api.removeNode('PurchaseRequisitionItems')
      refreshDraft(api, rfq, 'PR')
    }
  }, {
    key: 'rfq:record', on: { resource: RESOURCE, record: true }, immediate: false,
    handler: (value, api) => refreshDraft(api, rfq, rfq ? 'PR' : api.getControls('SourceType', 'PR', RESOURCE))
  }, {
    key: 'rfq:suppliers', on: { resource: RESOURCE, control: 'SelectedSupplierCodes' }, immediate: false,
    handler: (value, api) => refreshDraft(api, rfq, rfq ? 'PR' : api.getControls('SourceType', 'PR', RESOURCE))
  }, {
    key: 'rfq:directItems', on: { resource: RESOURCE, control: 'DirectItems' }, immediate: false, deep: false,
    handler: (value, api) => refreshDraft(api, rfq, rfq ? 'PR' : api.getControls('SourceType', 'PR', RESOURCE))
  }]
  return prepared
}
