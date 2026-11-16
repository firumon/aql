import { validateRequisitionDraft } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import { useAuth } from 'src/composables/core/useAuth'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { canEditRequisition } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

const NODE = 'PurchaseRequisitions'
const CHILD = 'PurchaseRequisitionItems'

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const parent = pageState.useNode(NODE)
  const { user } = useAuth()
  const rfqConfig = useResourceConfig('RFQs')
  return {
    get showFormActions () {
      if (!['add', 'edit'].includes(props.page) || !parent.exists.value) return false
      const source = resourceRecord?.record?.value
      return props.page === 'add' || canEditRequisition(source, user.value?.id, {
        updateAllowed: resourceConfig.allowed('update', NODE, source), rfqCreateAllowed: rfqConfig.allowed('create')
      })
    },
    actions: ['cancel', 'submit'],
    submitLabel: props.page === 'edit' ? 'Save Changes' : 'Submit Requisition',
    cancel: (name, { nav }) => { nav.goTo(parent.record.value.Code ? 'view' : 'index'); return false },
    submit: () => {
      const source = props.page === 'edit' ? resourceRecord?.record?.value : null
      if (props.page === 'edit' && (!source?.Code || !canEditRequisition(source, user.value?.id, {
        updateAllowed: resourceConfig.allowed('update', NODE, source), rfqCreateAllowed: rfqConfig.allowed('create')
      }))) return { valid: false, message: 'You cannot edit this requisition.' }
      const problem = validateRequisitionDraft({
        source, userId: user.value?.id, form: parent.record.value, items: parent.children(CHILD).value
      })
      if (problem) return { valid: false, message: problem }
    },
    successRoute: 'view'
  }
}
