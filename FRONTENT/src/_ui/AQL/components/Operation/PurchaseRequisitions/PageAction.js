import { validateRequisitionDraft } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import { isEditable } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

const NODE = 'PurchaseRequisitions'
const CHILD = 'PurchaseRequisitionItems'

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const parent = pageState.useNode(NODE)
  const step = () => pageState.meta.currentStep || 1
  return {
    get showFormActions () {
      if (!['add', 'edit'].includes(props.page) || !parent.exists.value) return false
      const source = resourceRecord?.record?.value
      return props.page === 'add' || (isEditable(source) && resourceConfig.allowed('update', NODE, source))
    },
    get actions () { return step() === 1 ? ['cancel', 'next'] : step() === 2 ? ['back', 'next'] : ['back', 'submit'] },
    get submitLabel () {
      if (pageState.getControls('isDraft', false, NODE)) return 'Save Draft'
      return pageState.getControls('isApproved', false, NODE) ? 'Approve' : 'Submit for Approval'
    },
    cancel: (name, { nav }) => { nav.goTo(parent.record.value.Code ? 'view' : 'index'); return false },
    next: () => {
      const problem = validateRequisitionDraft({
        source: resourceRecord?.record?.value, form: parent.record.value,
        items: parent.children(CHILD).value, headerOnly: step() === 1
      })
      if (problem) return { valid: false, message: problem }
    },
    submit: () => {
      const source = resourceRecord?.record?.value
      const editing = pageState.getControls('formMode', '', NODE) === 'edit'
      if ((editing && !source?.Code) || !resourceConfig.allowed(editing ? 'update' : 'create', NODE, source)) {
        return { valid: false, message: 'You are not allowed to save this requisition.' }
      }
      const error = pageState.getControls('submissionError', '', NODE)
      const problem = error || validateRequisitionDraft({ source, form: parent.record.value, items: parent.children(CHILD).value })
      if (problem) return { valid: false, message: problem }
      if (pageState.getControls('isApproved', false, NODE) && !pageState.getControls('isDraft', false, NODE) &&
        !resourceConfig.allowed('review', NODE, source)) {
        return { valid: false, message: 'You are not allowed to approve this requisition.' }
      }
    },
    successRoute: 'index'
  }
}
