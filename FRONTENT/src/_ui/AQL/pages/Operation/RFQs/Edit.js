import { useRFQFormSeed } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQFormContext'

export default {
  sections: ['PageHeader'],
  contents: ['SelectPendingPRs', 'ItemDescriptions', 'RFQTerms', 'CriteriaSelection',
    'CriterionOptions', 'ReviewSummary', 'ReviewItems', 'ReviewTerms'],
  PropsSelectPendingPRs: { step: 1 },
  PropsItemDescriptions: { step: 1 },
  PropsRFQTerms: { step: 2 },
  PropsContent: (pageProps) => ({ gutter: pageProps.gutter }),

  PropsPageHeader: {
    title: 'Edit RFQ',
    reload: false
  },

  ready (ctx) {
    ctx.pageState.resetForResource('RFQs')
    useRFQFormSeed(ctx)
  }
}
