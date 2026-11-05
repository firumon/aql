import { useRFQCriteria } from 'src/_resource/Operation/RFQs/composables/useRFQCriteria'
import { validateRFQDraftNodes } from 'src/_resource/Operation/RFQs/composables/useRFQForm'

export default (props, { pageState, resourceRecord }) => {
  const parent = pageState.useNode('RFQs')
  const criteria = useRFQCriteria()

  return {
    get actions () {
      const step = pageState.meta.currentStep || 1
      const plan = criteria.stepsOf(parent.record.value, true)
      return step === plan.review ? ['back', 'submit'] : step === 1 ? ['cancel', 'next'] : ['back', 'next']
    },
    submitLabel: 'Save RFQ',
    cancel: (name, { nav }) => { nav.goTo('view'); return false },
    next: () => {
      const step = pageState.meta.currentStep || 1
      const plan = criteria.stepsOf(parent.record.value, true)
      return validateRFQDraftNodes({ record: parent.record.value, original: resourceRecord?.record?.value,
        stage: step === 1 ? 'criteria' : step === 2 ? 'basics' : 'criterion', criterionId: plan.selected[step - 3]?.id })[0]
    },
    submit: () => validateRFQDraftNodes({ record: parent.record.value, original: resourceRecord?.record?.value })[0],
    successRoute: 'view'
  }
}
