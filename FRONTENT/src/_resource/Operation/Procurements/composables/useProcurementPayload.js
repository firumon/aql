import { textOrRef, isBatchRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import { stampFields } from 'src/utils/workflowStamp'
import { canAdvanceTo, progressOf, PR_CREATED, PR_APPROVED, COMPLETED, CANCELLED } from './useProcurementProgress'

const RESOURCE_NAME = 'Procurements'
const PROCUREMENT_REF_PATH = `${RESOURCE_NAME}.latest.code`

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

const MOVE = { update: 'You are not allowed to move this procurement.' }
const RAISE = { create: 'You are not allowed to raise a procurement.' }

export { RESOURCE_NAME, PROCUREMENT_REF_PATH }

export function todayDashed () {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function buildProcurementProgressNode (procurement, nextProgress, reload = []) {
  const row = asRow(procurement)
  const rawCode = row.Code
  if (!rawCode || isBatchRef(rawCode)) return null
  const code = text(rawCode)
  if (!code || code.startsWith('$ref:') || code.startsWith('[object')) return null
  if (!canAdvanceTo(row, nextProgress)) return null
  return { resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: text(nextProgress).toUpperCase() }, permissions: MOVE, reload: reload }
}

export function buildProcurementRollbackNode (procurement, previousProgress, reload = []) {
  const row = asRow(procurement)
  const rawCode = row.Code
  if (!rawCode || isBatchRef(rawCode)) return null
  const code = text(rawCode)
  const target = text(previousProgress).toUpperCase()
  if (!code || code.startsWith('$ref:') || code.startsWith('[object') || !target) return null
  const current = progressOf(row)
  if (!current || current === COMPLETED || current === target) return null
  return { resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: target }, permissions: MOVE, reload: reload }
}

export function buildProcurementCancelNode (procurement, optionsOrReload = []) {
  const opts = Array.isArray(optionsOrReload) ? { reload: optionsOrReload } : asRow(optionsOrReload)
  const reload = Array.isArray(opts.reload) ? opts.reload : []
  const row = asRow(procurement)
  const rawCode = row.Code
  if (!rawCode || isBatchRef(rawCode)) return null
  const code = text(rawCode)
  if (!code || code.startsWith('$ref:') || code.startsWith('[object') || progressOf(row) === CANCELLED || progressOf(row) === COMPLETED) return null
  const stamp = (text(opts.actorName) || text(opts.comment))
    ? stampFields('ProgressCancelled', opts.actorName, opts.comment) : {}
  return { resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: CANCELLED, ...stamp }, permissions: MOVE, reload }
}

export function buildProcurementCreateNode (options = {}, actorName = '', actorRole = '') {
  let progress = PR_APPROVED
  let user = actorName
  let role = actorRole
  let status = 'Active'
  let initiatedDate = todayDashed()

  if (options && typeof options === 'object' && !Array.isArray(options) && !options.$ref) {
    progress = options.progress || options.Progress || PR_APPROVED
    user = options.actorName || options.CreatedUser || actorName
    role = options.actorRole || options.CreatedRole || actorRole
    status = options.status || options.Status || 'Active'
    initiatedDate = options.initiatedDate || options.InitiatedDate || todayDashed()
  } else if (typeof options === 'string' && options) {
    progress = options
  }

  return {
    resource: RESOURCE_NAME,
    code: null,
    record: {
      Progress: text(progress).toUpperCase(),
      InitiatedDate: text(initiatedDate) || todayDashed(),
      CreatedUser: text(user),
      CreatedRole: text(role),
      Status: text(status) || 'Active'
    },
    permissions: RAISE
  }
}

export function procurementStamp (prefix, actorName = '', comment = '') {
  return {
    [`${prefix}At`]: toDateTime24(new Date()),
    [`${prefix}By`]: text(actorName),
    [`${prefix}Comment`]: text(comment)
  }
}

export function useProcurementPayload () {
  return {
    buildProcurementProgressNode,
    buildProcurementRollbackNode,
    buildProcurementCancelNode,
    buildProcurementCreateNode,
    procurementStamp,
    todayDashed,
    PROCUREMENT_REF_PATH
  }
}
