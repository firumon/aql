import { validateRequisitionDraft } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import {
  REVIEW_ACTIONS, PROGRESS_STAMP_PREFIX, isPendingApproval
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

const NODE = 'PurchaseRequisitions'

export default (props, { pageState, resourceRecord, resourceConfig }) => {
  const decision = () => REVIEW_ACTIONS[pageState.getRecord('Progress', NODE)] || ''
  return {
    get showFormActions () {
      const source = resourceRecord?.record?.value
      return pageState.hasNode(NODE) && isPendingApproval(source) && resourceConfig.allowed('review', NODE, source)
    },
    actions: ['cancel', 'submit'],
    get submitLabel () {
      return { approve: 'Approve Requisition', sendBack: 'Request Revision', reject: 'Reject Requisition' }[decision()] || 'Review'
    },
    get submitColor () { return { approve: 'positive', sendBack: 'warning', reject: 'negative' }[decision()] || 'primary' },
    get submitIcon () { return { approve: 'check_circle', sendBack: 'undo', reject: 'cancel' }[decision()] || 'rate_review' },
    cancel: (name, { nav }) => { nav.goTo('index'); return false },
    submit: () => {
      const source = resourceRecord?.record?.value
      if (!decision()) return { valid: false, message: 'Please choose a review progress.' }
      const error = pageState.getControls('submissionError', '', NODE)
      const prefix = PROGRESS_STAMP_PREFIX[pageState.getRecord('Progress', NODE)]
      const problem = error || validateRequisitionDraft({
        source, action: decision(), comment: pageState.getRecord(`${prefix}Comment`, NODE)
      })
      if (problem) return { valid: false, message: problem }
      if (!resourceConfig.allowed('review', NODE, source)) return { valid: false, message: 'You are not allowed to review this requisition.' }
    },
    successRoute: 'index'
  }
}
