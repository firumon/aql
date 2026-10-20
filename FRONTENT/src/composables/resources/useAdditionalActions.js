import {reactive, computed, unref, onUnmounted} from 'vue'
import { useQuasar } from 'quasar'
import { useResourceConfig, isActionVisible } from './useResourceConfig'
import { useResourceNav } from './useResourceNav'
import { useAdditionalActionsPipeline, actionLabelOf, actionFailureMessage } from './additionalActionsPipeline'
import { usePageState } from './pageState'

const dialog = reactive({
  open: false,
  resource: '',
  record: null,
  action: null,
  outcome: '',
  submitting: false,
  error: ''
})

// Navigate targets whose route carries a `:code` segment.
const TARGETS_NEEDING_CODE = new Set(['view', 'edit', 'action', 'record'])


export function useAdditionalActions (resourceName = null) {
  const explicit = unref(resourceName) || undefined
  const { additionalActions, permissions, allowed, resourceName: activeName } = useResourceConfig(explicit)
  const nav = useResourceNav()

  function actionsFor (record, { only, exclude } = {}) {
    const allow = Array.isArray(only) && only.length ? only.map(String) : null
    const deny = Array.isArray(exclude) && exclude.length ? exclude.map(String) : null
    const wantResourceLevel = !record

    return (additionalActions.value || []).filter((action) => {
      const name = String(action?.action ?? '')
      if (!name) return false
      if ((action.resourceLevel === true) !== wantResourceLevel) return false
      if (allow && !allow.includes(name)) return false
      if (deny && deny.includes(name)) return false
      if (!allowed(name, activeName.value, record)) return false
      // A resource-level action writes a new row, so it also needs plain write access.
      if (wantResourceLevel && permissions.value?.canWrite === false) return false
      return isActionVisible(action, record)
    })
  }

  function entriesFor (record, options = {}) {
    return actionsFor(record, options).map((action) => ({
      key: `additional:${action.action}`,
      name: action.action,
      // Matches the per-item resolver convention ResourceActions already uses, so
      // a tenant may still override one workflow FAB item on disk.
      actionName: `ResourceAction${pascal(action.action)}`,
      action,
      props: {
        icon: action.icon || 'bolt',
        color: action.color || 'primary',
        label: action.label || action.action,
        tooltip: action.label || action.action
      },
      run: () => runAction(action, record)
    }))
  }

  function runAction (action, record) {
    if (action?.kind === 'navigate') {
      // `navigate.target` is a route name (see useResourceNav) — an unknown value
      // is rejected there rather than silently rewritten here.
      const target = action.navigate?.target || 'record'
      const slug = action.navigate?.pageSlug || ''
      const params = {
        scope: action.navigate?.scope,
        resourceSlug: action.navigate?.resourceSlug,
        pageSlug: slug
      }
      // `_action/:action` is its own segment, NOT `:pageSlug` — an action target
      // authored with only a pageSlug would otherwise push an empty :action param.
      if (target === 'action') params.action = action.navigate?.action || slug
      if (TARGETS_NEEDING_CODE.has(target)) params.code = action.navigate?.code || record?.Code
      if (record?.Code && target === 'resource') params.query = { code: record.Code }
      nav.goTo(target, params)
      return
    }
    openAction(action, record)
  }

  function openAction (action, record) {
    // Read at click time, not setup: with no explicit name this follows the route.
    dialog.resource = explicit || activeName.value
    dialog.record = record
    dialog.action = action
    dialog.outcome = action?.columnValue || ''
    dialog.error = ''
    dialog.open = true
  }

  return { additionalActions, actionsFor, entriesFor, runAction, openAction }
}

function pascal (value) {
  const raw = String(value ?? '').trim()
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : ''
}


export function useAdditionalActionsDialog () {
  const $q = useQuasar()
  const pipeline = useAdditionalActionsPipeline()
  // The dialog's own submission channel. No nodes are ever created on it, so
  // `validationErrors` stays empty and build() emits only the queued action.
  const pageState = usePageState({}, { persist: false })

  const action = computed(() => dialog.action)
  const record = computed(() => dialog.record)
  const actionName = computed(() => String(action.value?.action || ''))

  const isMultiOutcome = computed(() => {
    const options = action.value?.columnValueOptions
    return Array.isArray(options) && options.length > 0
  })
  const outcomeOptions = computed(() => action.value?.columnValueOptions || [])

  const column = computed(() => action.value?.column || 'Progress')
  const columnValue = computed(() => dialog.outcome || action.value?.columnValue || '')

  const groups = computed(() => {
    if (!action.value) return []
    return pipeline.actionFieldGroups(action.value, {
      record: record.value,
      outcome: columnValue.value,
      resource: dialog.resource
    })
  })

  // The queued entry this dialog is editing. Held so submit can check the code
  // it resolved before sending.
  let queued = null

  // Source fields live under `fields`, target fields under `targets` — the two
  // wire buckets `extractActionPayload` already splits them into.
  function fieldPath (group, field) {
    return group.key ? `targets.${field.address}` : `fields.${field.address}`
  }

  function readField (group, field) {
    const value = pageState.getActions(actionName.value, fieldPath(group, field), dialog.resource)
    return value === undefined || value === null ? '' : value
  }

  function writeField (group, field, value) {
    pageState.setActions(actionName.value, fieldPath(group, field), value, dialog.resource)
  }

  // Re-queue with empty data, so every field falls back to its own seed.
  function syncForm () {
    pageState.excludeAdditionalAction()
    queued = null
    if (!action.value) return
    queued = pageState.includeAdditionalAction(actionName.value, {}, {
      resource: dialog.resource,
      code: record.value?.Code,
      record: record.value,
      outcome: columnValue.value
    })
  }

  // `validateActionForm` reads a FLAT address map — the shape a `when` gate keyed
  // on `field` resolves against — so the queued buckets are folded back into one.
  function flatForm () {
    const values = {}
    for (const group of groups.value) {
      for (const field of group.fields) values[field.address] = readField(group, field)
    }
    return values
  }

  function validate () {
    return pipeline.validateActionForm(action.value, {
      record: record.value,
      form: flatForm(),
      outcome: columnValue.value,
      resource: dialog.resource,
      groups: groups.value
    })
  }

  async function submit () {
    const invalid = validate()
    if (invalid) {
      dialog.error = invalid
      return false
    }

    const resourceLevel = action.value?.resourceLevel === true
    if (!queued || typeof queued.code !== 'string' || (!queued.code && !resourceLevel)) {
      dialog.error = 'Action is not executable.'
      return false
    }

    dialog.submitting = true
    dialog.error = ''
    try {
      const { success, response } = await pageState.run({ notify: false })
      if (!success) {
        // Stay open with the message inline — the user keeps what they typed and
        // can correct it, which a dismissable toast would not allow.
        dialog.error = actionFailureMessage(response) || 'Request failed.'
        return false
      }

      $q.notify({
        type: 'positive',
        message: `${actionLabelOf(action.value)} completed`,
        position: 'top'
      })
      close()
      return true
    } catch (err) {
      dialog.error = err?.message || 'Action failed.'
      return false
    } finally {
      dialog.submitting = false
    }
  }

  function close () {
    pageState.excludeAdditionalAction()
    queued = null
    dialog.open = false
    dialog.action = null
    dialog.record = null
    dialog.error = ''
  }

  function setOutcome (value) {
    dialog.outcome = value
  }

  return {
    dialog,
    pageState,
    actionName,
    groups,
    isMultiOutcome,
    outcomeOptions,
    column,
    columnValue,
    readField,
    writeField,
    syncForm,
    submit,
    close,
    setOutcome
  }
}
