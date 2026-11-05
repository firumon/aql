import { watch } from 'vue'
import { buildRFQFormInitNodes } from 'src/_resource/Operation/RFQs/composables/useRFQForm'

export default {
  sections: ['PageHeader'],
  contents: ['CriteriaSelection', 'RFQTerms', 'ItemDescriptions', 'CriterionOptions', 'ReviewRFQ'],
  PropsCriterionOptions: (pageProps) => ({ gutter: pageProps.gutter }),
  PropsRFQTerms: { step: 2 },
  PropsReviewRFQ: { mode: 'edit' },

  PropsPageHeader: {
    title: 'Edit RFQ',
    reload: false
  },

  ready ({ pageState, resourceRecord }) {
    pageState.resetForResource('RFQs')
    watch([() => resourceRecord?.record?.value, () => resourceRecord?.loading?.value,
      () => resourceRecord?.backgroundSyncing?.value], ([record, loading, syncing]) => {
      if (!loading && !syncing && record?.Code && pageState.useNode('RFQs').node.value.code !== record.Code) {
        pageState.applyNodes(buildRFQFormInitNodes({ rfq: record }))
      }
    }, { immediate: true })
  }
}
