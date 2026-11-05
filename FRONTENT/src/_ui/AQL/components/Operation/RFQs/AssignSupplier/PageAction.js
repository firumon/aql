import { buildAssignSuppliersChainNodes } from 'src/_resource/Operation/RFQs/composables/useRFQPayload'

const NODE = 'RFQs'
const SELECTED = 'SelectedSupplierCodes'

const text = (value) => String(value ?? '').trim()

// [ Cancel ] [ Assign Suppliers ]
export default (props, { pageState, resourceConfig, resourceRecord }) => {
  pageState.useNode(NODE)
  let landing = null

  const rfq = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const selected = () => {
    const value = pageState.getControls(SELECTED, null, NODE)
    return Array.isArray(value) ? value : []
  }

  return {
    showFormActions: true,
    actions: ['cancel', 'submit'],
    submitLabel: 'Assign Suppliers',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const result = buildAssignSuppliersChainNodes({
        rfq: rfq(),
        supplierCodes: selected(),
        existingSupplierRows: rfq()?.$RFQSuppliers || rfq()?.$rfqsuppliers || []
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      landing = { rfq: text(rfq()?.Code), suppliers: [...selected()] }
      return { successMsg: applied.successMsg }
    },

    onSubmitSuccess: (result, { nav }) => {
      if (!landing?.rfq || !landing.suppliers.length) return nav.goTo('view')
      nav.goTo('index', { scope: 'operation', resourceSlug: 'rfq-suppliers',
        query: { rfq: landing.rfq, suppliers: landing.suppliers.join(',') } })
    }
  }
}
