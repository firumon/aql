import { buildRFQFormInitNodes } from 'src/_resource/Operation/RFQs/composables/useRFQForm'

export default {
  sections: ['PageHeader'],
  contents: ['SelectRequisition', 'DirectItems', 'CriteriaSelection', 'CriterionOptions', 'SupplierSelection', 'ReviewRFQ'],

  PropsPageHeader: {
    title: 'Generate RFQ',
    reload: false
  },

  PropsSelectRequisition: { step: 1 },
  PropsDirectItems: { step: 2 },
  PropsCriterionOptions: (pageProps) => ({ gutter: pageProps.gutter }),

  ready ({ pageState }) {
    pageState.resetForResource('RFQs')
    pageState.initResource('Procurements')
    pageState.initResource('PurchaseRequisitions')
    pageState.applyNodes(buildRFQFormInitNodes())
  }
}
