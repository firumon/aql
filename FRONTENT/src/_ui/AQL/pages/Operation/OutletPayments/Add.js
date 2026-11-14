import {
  buildOutletPaymentInitNodes,
  canCollectInvoicePayment
} from 'src/_ui/AQL/composables/Operation/OutletPayments/Add/useOutletPaymentAddContext'

export default {
  sections: ['PageHeader'],
  contents: [
    'SelectOutlet',
    'SelectInvoices',
    'PayingAmount',
    'AutoApproveToggle',
    'InvoiceAllocation',
    'ModeReference'
  ],

  permissions: {
    SelectInvoices: ['OutletConsumptionInvoices'],
    AutoApproveToggle: ['OutletConsumptionInvoices:collectPayment'],
    InvoiceAllocation: ['OutletConsumptionInvoices:collectPayment']
  },

  PropsSelectOutlet: {
    suggestLimit: 7
  },

  PropsPageHeader: {
    title: 'Record Payment',
    reload: false
  },

  ready ({ pageState, routeInfo }) {
    const query = routeInfo.value.query || {}
    pageState.resetForResource('OutletPayments')
    pageState.applyNodes(buildOutletPaymentInitNodes({
      outletCode: String(query.outletCode || '').trim()
    }))
    pageState.setControls('AutoApprove', canCollectInvoicePayment())
  }
}
