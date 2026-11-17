import { useRFQRequirements } from 'src/_resource/Operation/RFQs/composables/useRFQRequirements'
import { validateRFQDraftNodes } from 'src/_resource/Operation/RFQs/composables/useRFQForm'
import { isEditable } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'

export default (props, { pageState, resourceRecord }) => {
  const parent = pageState.useNode('RFQs')
  const requirements = useRFQRequirements()
  const editing = true
  const original = () => editing ? resourceRecord?.record?.value : null
  const plan = () => requirements.stepsOf(parent.record.value, editing)
  const requirementInputErrors = () => pageState.getControls('RequirementInputErrors', {}, 'RFQs') || {}
  const check = (stage = 'all') => validateRFQDraftNodes({ record: parent.record.value, original: original(), stage,
    items: pageState.getChildRows('RFQItems', 'RFQs'),
    suppliers: pageState.getControls('SelectedSupplierCodes', [], 'RFQs'),
    requirementId: plan().selected[(pageState.meta.currentStep || 1) - 4]?.id })[0]
  return {
    get actions () {
      if (editing && !isEditable(original())) return ['cancel']
      const step = pageState.meta.currentStep || 1
      return step === plan().review ? ['back', 'submit'] : step === 1 ? ['cancel', 'next'] : ['back', 'next']
    },
    submitLabel: 'Save RFQ',
    next: () => {
      const step = pageState.meta.currentStep || 1
      const failed = Object.values(requirementInputErrors()).find((entry) => entry?.step === step)
      if (failed) return { valid: false, message: failed.message }
      return check(step === 1 ? 'items' : step === 2 ? 'basics' : step === 3 ? 'requirements'
        : step === plan().suppliers ? 'suppliers' : 'requirement')
    },
    back: () => {
      const step = pageState.meta.currentStep || 1
      const errors = { ...requirementInputErrors() }
      for (const [key, entry] of Object.entries(errors)) {
        if (entry?.step === step) delete errors[key]
      }
      pageState.setControls('RequirementInputErrors', errors, 'RFQs')
    },
    submit: () => {
      const failed = Object.values(requirementInputErrors())[0]
      if (failed) return { valid: false, message: failed.message }
      return check() || (pageState.getControls('DraftError', '', 'RFQs')
        ? { valid: false, message: pageState.getControls('DraftError', '', 'RFQs') } : undefined)
    },
    successRoute: editing ? 'view' : 'index'
  }
}
