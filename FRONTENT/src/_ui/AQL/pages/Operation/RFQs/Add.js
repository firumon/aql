import { buildRFQFormInitNodes } from 'src/_resource/Operation/RFQs/composables/useRFQForm'

export default {
  sections: ['PageHeader'],
  contents: ['SelectPendingPRs', 'ItemDescriptions', 'RFQTerms', 'CriteriaSelection',
    'CriterionOptions', 'SupplierSelection', 'ReviewSummary', 'ReviewItems', 'ReviewSuppliers', 'ReviewTerms'],

  PropsPageHeader: {
    title: 'Generate RFQ',
    reload: false
  },

  PropsSelectPendingPRs: { step: 1 },
  PropsItemDescriptions: { step: 1 },
  PropsRFQTerms: { step: 2 },
  PropsContent: (pageProps) => ({ gutter: pageProps.gutter }),

  ready ({ pageState }) {
    if (pageState.getControls('AddSeeded', false, 'RFQs') === true) return
    pageState.resetForResource('RFQs')
    pageState.applyNodes(buildRFQFormInitNodes())
    pageState.setControls('AddSeeded', true, 'RFQs')
  }
}
