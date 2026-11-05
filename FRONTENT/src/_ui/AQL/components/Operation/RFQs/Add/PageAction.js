import { batchResultCode } from 'src/composables/resources/resourceRequests'
import { useRFQCriteria } from 'src/_resource/Operation/RFQs/composables/useRFQCriteria'
import { validateRFQDraftNodes } from 'src/_resource/Operation/RFQs/composables/useRFQForm'
import { findResourceConfig } from 'src/composables/resources/useResourceConfig'

const NODE = 'RFQs'

export default (props, { pageState }) => {
  const parent = pageState.useNode(NODE)
  const criteria = useRFQCriteria()
  let landing = null
  const control = (key, fallback = null) => pageState.getControls(key, fallback, NODE)
  const step = () => pageState.meta?.currentStep || 1
  const isDirect = () => !findResourceConfig('PurchaseRequisitions')?.permissions?.canRead ||
    control('SourceType', 'PR') === 'DIRECT'

  return {
    get actions () {
      const plan = criteria.stepsOf(parent.record.value)
      if (step() === plan.review) return ['back', 'submit']
      return step() === 1 ? ['cancel', 'next'] : ['back', 'next']
    },
    submitLabel: 'Save RFQ',
    cancel: (name, { nav }) => { nav.goTo('index'); return false },
    next: () => {
      const plan = criteria.stepsOf(parent.record.value)
      const current = step()
      const sourceType = isDirect() ? 'DIRECT' : 'PR'
      const criterionIdx = current - (plan.criterionStart || 4)
      const error = validateRFQDraftNodes({
        record: parent.record.value,
        suppliers: control('SelectedSupplierCodes', []),
        sourceType,
        directItems: control('DirectItems', []),
        stage: current === 1 ? 'source' : current === 2 ? 'items' : current === 3 ? 'criteria' : current === plan.suppliers ? 'suppliers' : 'criterion',
        criterionId: plan.selected[criterionIdx]?.id
      })[0]
      if (error) return error
      if (current === 1 && sourceType === 'PR') return { step: plan.criteria }
      if (current === 2 && sourceType === 'PR') return { step: plan.criteria }
      return undefined
    },
    back: () => {
      const plan = criteria.stepsOf(parent.record.value)
      if (!isDirect() && step() === plan.criteria) return { step: 1 }
      return undefined
    },
    submit: () => {
      const suppliers = control('SelectedSupplierCodes', [])
      const error = validateRFQDraftNodes({
        record: parent.record.value,
        suppliers,
        sourceType: isDirect() ? 'DIRECT' : 'PR',
        directItems: control('DirectItems', [])
      })[0]
      if (error) return error
      landing = { at: pageState.build().findIndex((request) => request.resource === NODE) }
    },
    onSubmitSuccess: ({ response }, { nav }) => {
      const code = landing?.at >= 0 ? batchResultCode(response, landing.at) : ''
      if (!code) return nav.goTo('index')
      nav.goTo('view', { code })
    }
  }
}
