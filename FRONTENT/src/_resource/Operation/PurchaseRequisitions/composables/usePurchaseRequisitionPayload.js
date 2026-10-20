import { textOrRef, batchRef, isBatchRef } from 'src/utils/appHelpers'
import {
  buildProcurementCreateNode,
  buildProcurementProgressNode,
  buildProcurementCancelNode,
  PROCUREMENT_REF_PATH
} from 'src/_resource/Operation/Procurements/composables/useProcurementPayload'
import {
  PR_APPROVED,
  PR_CREATED,
  INITIATED
} from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import {
  DRAFT,
  PENDING_APPROVAL,
  REVISION_REQUIRED,
  APPROVED,
  REJECTED,
  RFQ_PROCESSED,
  REVIEW_ACTIONS,
  PROGRESS_STAMP_PREFIX,
  progressOf,
  isPendingApproval,
  isEditable,
  isActiveRow
} from './usePurchaseRequisitionProgress'

import { stampFields } from 'src/utils/workflowStamp'
import { addDays, toDateOnly } from 'src/utils/dateHelpers'
import { useProcurementResource } from 'src/_resource/Operation/Procurements/composables/useProcurementResource'
import { resourceRow, useResourceConfig } from 'src/composables/resources/useResourceConfig'
const RESOURCE_NAME = 'PurchaseRequisitions'
const ITEMS_RESOURCE = 'PurchaseRequisitionItems'
const REFRESH_RESOURCES = ['Procurements']

export { RESOURCE_NAME, ITEMS_RESOURCE }

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function isLiteralProcurementCode (value) {
  if (!value) return false
  if (isBatchRef(value)) return false
  const str = text(value)
  if (!str) return false
  if (str.startsWith('$ref:') || str.startsWith('[object')) return false
  return true
}

export function todayDashed () {
  return toDateOnly(new Date())
}

export function defaultRequiredDate () {
  return toDateOnly(addDays(new Date(), 7))
}

export function requisitionItemRow (child = {}, extra = {}) {
  return resourceRow(ITEMS_RESOURCE, child, extra)
}

export function syncRequisitionItems (pageState, selectedSkus = [], selectedCodes) {
  if (!pageState) return
  const selected = new Set(Array.isArray(selectedCodes) ? selectedCodes : selectedSkus.map((row) => row.Code))
  const rows = pageState.getChildRows(ITEMS_RESOURCE, RESOURCE_NAME)
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index]
    if (row._action === 'deactivate' || !row.SKU || selected.has(row.SKU)) continue
    if (row.Code) pageState.setChildAction(ITEMS_RESOURCE, index, 'deactivate', RESOURCE_NAME)
    else pageState.removeChild(ITEMS_RESOURCE, index, RESOURCE_NAME)
  }
  const bySku = new Map()
  rows.forEach((row, index) => {
    if (!bySku.has(row.SKU) || row._action !== 'deactivate') bySku.set(row.SKU, { row, index })
  })
  for (const sku of selectedSkus) {
    if (!sku?.Code) continue
    const existing = bySku.get(sku.Code)
    if (existing) {
      if (existing.row._action === 'deactivate') {
        pageState.setChildAction(ITEMS_RESOURCE, existing.index, 'update', RESOURCE_NAME)
      }
      continue
    }
    const index = pageState.addChild(ITEMS_RESOURCE, requisitionItemRow({
      SKU: sku.Code, ...(text(sku.UOM) ? { UOM: sku.UOM } : {})
    }), RESOURCE_NAME)
    bySku.set(sku.Code, { row: rows[index], index })
  }
}

export function validateRequisitionDraft ({ form = {}, items = [], source = null, action = '', comment = '', headerOnly = false } = {}) {
  const record = asRow(form)
  if (action) {
    if (!source?.Code || !isPendingApproval(source)) return 'This requisition is no longer awaiting approval.'
    if (!['approve', 'sendBack', 'reject'].includes(action)) return 'Please choose a review decision.'
    if (action !== 'approve' && !text(comment)) return 'Please enter a reason for this decision.'
    return null
  }
  if (source?.Code && !isEditable(source)) return 'Only a draft or returned requisition can be edited.'
  if (!unwrap(record.Type)) return 'Please select a requisition type.'
  if (!unwrap(record.Priority)) return 'Please select a priority.'
  if (!text(record.RequiredDate)) return 'Please select a required date.'
  if (!unwrap(record.WarehouseCode)) return 'Please select a destination warehouse.'
  if (headerOnly) return null
  const lines = items.filter((entry) => entry._action !== 'deactivate' && isActiveRow(entry))
  if (!lines.length) return 'Please add at least one product.'
  if (lines.some((entry) => !text(entry.SKU) || !Number.isFinite(Number(entry.Quantity)) || Number(entry.Quantity) < 1)) {
    return 'Every product must have a quantity of at least 1.'
  }
  if (new Set(lines.map((entry) => text(entry.SKU))).size !== lines.length) return 'Each product may appear only once.'
  return null
}

export function buildRequisitionInitNodes (options = {}) {
  const { form = null, items = [], mode = 'add', actorName = '', actorRole = '', canApprove = false } = options
  const code = text(form?.Code)
  if (mode === 'items') {
    const current = options.currentItems || []
    const bySku = new Map(current.map((row) => [row.SKU, row]))
    const incoming = dedupeItemLines(items).filter(isActiveRow)
    const sourceSkus = new Set(incoming.map((row) => row.SKU))
    const rows = incoming.map((row) => ({
      ...row, ...bySku.get(row.SKU), Code: row.Code,
      _action: bySku.get(row.SKU)?._action === 'deactivate' ? 'deactivate' : 'update'
    })).concat(current.filter((row) => !sourceSkus.has(row.SKU)))
    return [{
      resource: RESOURCE_NAME, code, merge: true,
      children: [{ resource: ITEMS_RESOURCE, records: rows }]
    }]
  }
  if (mode === 'review') {
    const { allowed } = useResourceConfig(RESOURCE_NAME)
    const progress = allowed('review', RESOURCE_NAME, form) ? APPROVED : ''
    const parent = {
      resource: RESOURCE_NAME, code, record: { Code: code, Progress: progress },
      permissions: { review: 'You are not allowed to review this requisition.' }
    }
    parent.controls = { submissionError: '', formMode: mode }
    parent.derive = ['Progress', ...Object.values(PROGRESS_STAMP_PREFIX).map((prefix) => `${prefix}Comment`)]
      .map((record) => ({
        key: `review:${record}`, on: { resource: RESOURCE_NAME, record }, immediate: record === 'Progress' && !!progress,
        handler: (value, api) => syncRequisitionSubmissionNodes(api, { mode, actorName, actorRole, source: form })
      }))
    return [parent]
  }
  const draft = code ? progressOf(form) === DRAFT : options.isDraft === true
  const approved = !code && !draft && canApprove
  const record = code ? resourceRow(RESOURCE_NAME, form) : resourceRow(RESOURCE_NAME, {
    PRDate: todayDashed(), RequiredDate: defaultRequiredDate(), ...options.overrides, Username: actorName
  })
  const nodes = buildRequisitionSaveChainNodes({
    code, form: record, items, draft, approved, actorName, actorRole, validate: false
  })
  const parent = nodes.find((node) => node.resource === RESOURCE_NAME)
  parent.controls = {
    isDraft: draft, isApproved: approved, entryProgress: progressOf(form) || DRAFT,
    selectedCode: code, responseComment: '', submissionError: '', formMode: mode
  }
  parent.derive = ['isDraft', 'isApproved', 'responseComment'].map((control) => ({
    key: `requisition:${control}`, on: { resource: RESOURCE_NAME, control }, immediate: false,
    handler: (value, api) => {
      if (control === 'isDraft') {
        const { allowed } = useResourceConfig(RESOURCE_NAME)
        api.setControls('isApproved', value !== true && allowed('review', RESOURCE_NAME, form), RESOURCE_NAME)
      } else if (control === 'isApproved' && api.getControls('isDraft', false, RESOURCE_NAME)) {
        api.setControls('isApproved', false, RESOURCE_NAME)
      }
      syncRequisitionSubmissionNodes(api, { actorName, actorRole, source: form })
    }
  }))
  return nodes
}

// A `_fields` select hands back `{ label, value }`; a plain input hands back a string.
function unwrap (value) {
  if (value && typeof value === 'object' && 'value' in value) return text(value.value)
  return text(value)
}

export function buildRequisitionFormData (form = {}, { targetProgress = '', extraFields = {} } = {}) {
  const record = resourceRow(RESOURCE_NAME, asRow(form))
  return {
    ...record,
    Type: unwrap(record.Type),
    Priority: unwrap(record.Priority),
    WarehouseCode: unwrap(record.WarehouseCode),
    PRDate: text(record.PRDate) || todayDashed(),
    RequiredDate: text(record.RequiredDate) || defaultRequiredDate(),
    TypeReferenceCode: text(record.TypeReferenceCode),
    Progress: text(targetProgress) || progressOf(record) || DRAFT,
    Status: text(record.Status),
    ...extraFields
  }
}

export function dedupeItemLines (items = []) {
  const bySku = new Map()
  for (const entry of (Array.isArray(items) ? items : []).map(asRow)) {
    const key = text(entry.SKU)
    if (!key) continue
    const existing = bySku.get(key)
    if (!existing || ((!isActiveRow(existing) || existing._action === 'deactivate') &&
      isActiveRow(entry) && entry._action !== 'deactivate')) bySku.set(key, entry)
  }
  return Array.from(bySku.values())
}

export function buildRequisitionItemRecords (items = [], deactivatedCodes = []) {
  const source = Array.isArray(items) ? items : []
  const lines = dedupeItemLines(source.filter((entry) => entry?._action !== 'deactivate' && isActiveRow(entry)))
    .map((entry) => requisitionItemRow(entry, {
      _action: text(entry.Code) ? 'update' : 'create',
      SKU: text(entry.SKU), Quantity: num(entry.Quantity ?? entry.requiredQuantity)
    }))
  const removals = [...new Set([
    ...(Array.isArray(deactivatedCodes) ? deactivatedCodes : []),
    ...source.filter((entry) => entry?._action === 'deactivate').map((entry) => entry.Code)
  ].map(text).filter(Boolean))].map((code) => ({ _action: 'deactivate', Code: code, Status: 'Inactive' }))

  return [...lines, ...removals]
}

export function buildRequisitionCompositeNode ({
  code = '', form = {}, targetProgress = '', extraFields = {}, items = [], deactivatedCodes = []
} = {}) {
  const isDraftProgress = targetProgress === DRAFT || (!targetProgress && progressOf(form) === DRAFT)
  return {
    resource: RESOURCE_NAME,
    ...(text(code) ? { code: text(code) } : {}),
    record: buildRequisitionFormData(form, { targetProgress, extraFields }),
    children: [{ resource: ITEMS_RESOURCE, records: buildRequisitionItemRecords(items, deactivatedCodes) }],
    successMsg: isDraftProgress ? 'Requisition saved as draft.' : 'Requisition submitted for approval.'
  }
}

export function syncRequisitionSubmissionNodes (pageState, { mode = '', actorName = '', actorRole = '', source = null } = {}) {
  if (!pageState) return
  const form = pageState.getRecord(null, RESOURCE_NAME) || {}
  const draft = pageState.getControls('isDraft', false, RESOURCE_NAME) === true
  const approved = !draft && pageState.getControls('isApproved', false, RESOURCE_NAME) === true
  const reviewAction = REVIEW_ACTIONS[form.Progress] || ''
  if (mode === 'review' && !reviewAction) {
    pageState.setControls('submissionError', 'Please choose a review progress.', RESOURCE_NAME)
    return
  }
  const nodes = mode === 'review' ? buildRequisitionReviewChainNodes({
    requisition: source, form, action: reviewAction,
    comment: form[`${PROGRESS_STAMP_PREFIX[form.Progress]}Comment`] || '', preview: true, actorName, actorRole,
    procurement: useProcurementResource().getProcurement(source?.ProcurementCode)
  }) : buildRequisitionSaveChainNodes({
    code: text(source?.Code), form, draft, approved, actorName, actorRole, validate: false,
    responseComment: pageState.getControls('responseComment', '', RESOURCE_NAME),
    revisionComment: text(source?.ProgressRevisionRequiredComment)
  })
  const parent = nodes.find((node) => node.resource === RESOURCE_NAME)
  if (parent && mode === 'review') {
    parent.merge = true
    for (const [progress, prefix] of Object.entries(PROGRESS_STAMP_PREFIX)) {
      if (progress === form.Progress) continue
      parent.record[`${prefix}At`] = source?.[`${prefix}At`] || ''
      parent.record[`${prefix}By`] = source?.[`${prefix}By`] || ''
      parent.record[`${prefix}Comment`] = source?.[`${prefix}Comment`] || ''
    }
  }
  if (parent && mode !== 'review') {
    parent.merge = true
    delete parent.children
  }
  const applied = pageState.applyNodes(nodes)
  pageState.setControls('submissionError', applied.valid === false ? applied.message : '', RESOURCE_NAME)
  if (applied.valid !== false && !nodes.some((node) => node.resource === 'Procurements')) pageState.removeNode('Procurements')
  return applied
}

export function buildRequisitionSaveChainNodes ({
  code = '',
  form = {},
  items = [],
  deactivatedCodes = [],
  draft = false,
  approved = false,
  procurement = null,
  actorName = '',
  actorRole = '',
  validate = true,
  responseComment = '',
  revisionComment = ''
} = {}) {
  const validationError = validate ? validateRequisitionDraft({ form, items }) : null
  if (validationError) {
    return [{ valid: false, message: validationError }]
  }

  const isApproved = !draft && approved
  const targetProgress = draft ? DRAFT : (isApproved ? APPROVED : PENDING_APPROVAL)
  const stamp = isApproved ? (progressOf(form) === APPROVED && text(form.ProgressApprovedAt) ? {
    ProgressApprovedAt: form.ProgressApprovedAt,
    ProgressApprovedBy: form.ProgressApprovedBy,
    ProgressApprovedComment: form.ProgressApprovedComment || ''
  } : stampFields('ProgressApproved', actorName, '')) : {
    ProgressApprovedAt: '', ProgressApprovedBy: '', ProgressApprovedComment: ''
  }
  const rawProcVal = asRow(procurement).Code || asRow(form).ProcurementCode
  const hasLiteralProc = isLiteralProcurementCode(rawProcVal)
  const rawProc = hasLiteralProc ? text(rawProcVal) : ''

  const linked = procurement || (rawProc ? useProcurementResource().getProcurement(rawProc) : null)
  const nodes = []

  if (!draft) {
    if (!hasLiteralProc) {
      nodes.push(buildProcurementCreateNode({
        progress: isApproved ? PR_APPROVED : PR_CREATED,
        actorName,
        actorRole
      }))
    } else {
      const advance = buildProcurementProgressNode(
        linked || { Code: rawProc, Progress: INITIATED },
        isApproved ? PR_APPROVED : PR_CREATED
      )
      if (advance) nodes.push(advance)
    }
  }

  nodes.push(buildRequisitionCompositeNode({
    code,
    form,
    extraFields: {
      ...(!text(code) ? { Username: actorName } : {}),
      ProcurementCode: hasLiteralProc ? rawProc : (draft ? '' : batchRef(PROCUREMENT_REF_PATH)),
      ...stamp,
      ...(!draft && (revisionComment || responseComment) ? {
        ProgressRevisionRequiredComment: [revisionComment, responseComment ? `${actorName}: ${text(responseComment)}` : '']
          .filter(Boolean).join('\n\n')
      } : {})
    },
    targetProgress,
    items,
    deactivatedCodes
  }))

  const parent = nodes.find((node) => node.resource === RESOURCE_NAME)
  parent.permissions = {
    [text(code) ? 'update' : 'create']: 'You are not allowed to save this requisition.',
    ...(isApproved ? { review: 'You are not allowed to approve this requisition.' } : {})
  }
  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

export function buildRequisitionReviewChainNodes ({
  requisition = null,
  form = {},
  action = '',
  comment = '',
  actorName = '',
  actorRole = '',
  procurement = null,
  preview = false
} = {}) {
  const record = asRow(requisition)
  const code = text(record.Code)
  const verdict = text(action)
  const note = text(comment)

  if (!code) {
    return [{ valid: false, message: 'No requisition loaded.' }]
  }
  if (!isPendingApproval(record)) {
    return [{ valid: false, message: 'This requisition is no longer awaiting approval.' }]
  }

  const nextProgress = Object.keys(REVIEW_ACTIONS).find((progress) => REVIEW_ACTIONS[progress] === verdict)
  if (!nextProgress) return [{ valid: false, message: 'Unsupported review action.' }]
  if (!preview) {
    const problem = validateRequisitionDraft({ source: record, action: verdict, comment: note })
    if (problem) return [{ valid: false, message: problem }]
  }
  const prefix = PROGRESS_STAMP_PREFIX[nextProgress]
  const keepStamp = text(form[`${prefix}At`]) && form[`${prefix}At`] !== record[`${prefix}At`]
  const stamp = keepStamp ? {
    [`${prefix}At`]: form[`${prefix}At`], [`${prefix}By`]: form[`${prefix}By`], [`${prefix}Comment`]: note
  } : stampFields(prefix, actorName, note)

  const rawProcVal = asRow(procurement).Code || record.ProcurementCode
  const hasLiteralProc = isLiteralProcurementCode(rawProcVal)
  const existingProcurementCode = hasLiteralProc ? text(rawProcVal) : ''
  const nodes = []
  const parent = {
    resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: nextProgress, ...stamp },
    permissions: { review: 'You are not allowed to review this requisition.' }
  }

  if (verdict === 'approve') {
    if (!existingProcurementCode) {
      nodes.push(buildProcurementCreateNode({
        progress: PR_APPROVED,
        actorName,
        actorRole
      }))
      parent.record.ProcurementCode = batchRef(PROCUREMENT_REF_PATH)
    } else {
      const chained = buildProcurementProgressNode(
        asRow(procurement).Code ? procurement : { Code: existingProcurementCode, Progress: INITIATED },
        PR_APPROVED
      )
      if (chained) nodes.push(chained)
    }
  } else if (verdict === 'reject') {
    if (existingProcurementCode) {
      const chained = buildProcurementCancelNode(
        asRow(procurement).Code ? procurement : { Code: existingProcurementCode }
      )
      if (chained) nodes.push(chained)
    }
  }

  nodes.push(parent, { resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

export function buildRequisitionRfqProcessedNode (requisitionCode) {
  const code = text(requisitionCode)
  if (!code) return null
  return { resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: RFQ_PROCESSED } }
}
