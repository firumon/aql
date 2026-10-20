import { validateRequisitionDraft } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { isRevisionRequired } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

const NODE = 'PurchaseRequisitions'
const CHILD = 'PurchaseRequisitionItems'

export default (props, { pageState, resourceConfig }) => {
  const { getPurchaseRequisition } = usePurchaseRequisitionResource()
  return {
    get showFormActions () {
      const source = getPurchaseRequisition(pageState.getControls('selectedCode', '', NODE))
      return isRevisionRequired(source) && resourceConfig.allowed('update', NODE, source)
    },
    actions: ['cancel', 'submit'], submitLabel: 'Send',
    cancel: (name, { nav }) => { nav.goTo('index'); return false },
    submit: () => {
      const source = getPurchaseRequisition(pageState.getControls('selectedCode', '', NODE))
      if (!isRevisionRequired(source) || !resourceConfig.allowed('update', NODE, source)) {
        return { valid: false, message: 'This requisition is no longer available for revision.' }
      }
      const error = pageState.getControls('submissionError', '', NODE)
      const problem = error || validateRequisitionDraft({
        source, form: pageState.getRecord(null, NODE), items: pageState.getChildRows(CHILD, NODE)
      })
      if (problem) return { valid: false, message: problem }
    },
    successRoute: 'index'
  }
}
