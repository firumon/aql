import {
  buildAssignSuppliersChainNodes,
  buildManageSuppliersStatusChainNodes
} from 'src/_resource/Operation/RFQs/composables/useRFQPayload'
import { canAssignSuppliers, supplierRowsOf } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'
import { useRFQResource } from 'src/_resource/Operation/RFQs/composables/useRFQResource'
import { useProcurementResource } from 'src/_resource/Operation/Procurements/composables/useProcurementResource'
import { useSupplierResource } from 'src/_resource/Master/Suppliers/composables/useSupplierResource'
import { useAuth } from 'src/composables/core/useAuth'

const text = (value) => String(value ?? '').trim()

export default (props, { pageState }) => {
  const rfqResource = useRFQResource()
  const procurementResource = useProcurementResource()
  const supplierResource = useSupplierResource()
  const { user } = useAuth()
  const rfqCode = () => pageState.getControls('RFQCode', '')
  const selectedCodes = () => {
    const codes = pageState.getControls('SelectedNewSupplierCodes', [])
    return Array.isArray(codes) ? codes : []
  }
  const pendingStatuses = () => {
    const statuses = pageState.getControls('PendingSupplierStatuses', {})
    return statuses && typeof statuses === 'object' && !Array.isArray(statuses) ? statuses : {}
  }
  const cancelReason = () => pageState.getControls('SupplierCancelReason', '')
  const hasPendingCancel = () => Object.values(pendingStatuses()).includes('CANCELLED')
  const hasAvailableSuppliers = (rfq, code) => {
    const taken = new Set(supplierRowsOf(rfq, rfqResource.suppliersOf(code))
      .map((row) => text(row.SupplierCode)))
    return supplierResource.activeChoices.value.some((row) => !taken.has(text(row.code)))
  }

  return {
    showFormActions: true,
    get actions () {
      const actions = [{ name: 'cancel', label: 'Back to RFQ', icon: 'arrow_back' }]
      const code = rfqCode()
      const rfq = rfqResource.getRFQ(code)
      if (canAssignSuppliers(rfq)) {
        if (Object.keys(pendingStatuses()).length > 0) {
          actions.push({
            name: 'submit',
            label: 'Apply Status',
            icon: 'check',
            disabled: () => hasPendingCancel() && !text(cancelReason())
          })
        } else if (hasAvailableSuppliers(rfq, code)) {
          actions.push({
            name: 'submit',
            label: 'Assign Suppliers',
            icon: 'group_add',
            disabled: () => !selectedCodes().length
          })
        }
      }
      return actions
    },

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const code = rfqCode()
      const rfq = rfqResource.getRFQ(code)
      const supplierCodes = [...selectedCodes()]
      const statusByCode = { ...pendingStatuses() }
      if (Object.keys(statusByCode).length > 0) {
        const reason = cancelReason()
        const nodes = buildManageSuppliersStatusChainNodes({
          rfq, statusByCode, supplierRows: rfqResource.suppliersOf(code),
          procurement: procurementResource.getProcurement(rfq?.ProcurementCode),
          comment: reason, actorName: user.value?.name || user.value?.email || ''
        })
        pageState.reset()
        pageState.setControls('RFQCode', code)
        pageState.setControls('PendingSupplierStatuses', statusByCode)
        pageState.setControls('SupplierCancelReason', reason)
        pageState.setControls('SelectedNewSupplierCodes', supplierCodes)
        const applied = pageState.applyNodes(nodes)
        if (applied.valid === false) return false
        return {
          successMsg: applied.successMsg,
          onSuccess: () => {
            pageState.reset()
            pageState.setControls('RFQCode', code)
            pageState.setControls('PendingSupplierStatuses', {})
            pageState.setControls('SupplierCancelReason', '')
            pageState.setControls('SelectedNewSupplierCodes', [])
          }
        }
      }

      const nodes = buildAssignSuppliersChainNodes({
        rfq, supplierCodes, existingSupplierRows: rfqResource.suppliersOf(code)
      })
      pageState.reset()
      pageState.setControls('RFQCode', code)
      pageState.setControls('PendingSupplierStatuses', {})
      pageState.setControls('SupplierCancelReason', '')
      pageState.setControls('SelectedNewSupplierCodes', supplierCodes)
      const applied = pageState.applyNodes(nodes)
      if (applied.valid === false) return false
      return {
        successMsg: applied.successMsg,
        onSuccess: () => {
          pageState.reset()
          pageState.setControls('RFQCode', code)
          pageState.setControls('PendingSupplierStatuses', {})
          pageState.setControls('SupplierCancelReason', '')
          pageState.setControls('SelectedNewSupplierCodes', [])
        }
      }
    }
  }
}
