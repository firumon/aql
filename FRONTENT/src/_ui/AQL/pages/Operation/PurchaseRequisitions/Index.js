export default {
  sections: ['PageHeader', 'RequisitionMetrics', 'UserSummary', 'FilterInput', 'ListSwitcher'],
  contents: ['List'],
  PropsPageHeader: { title: 'Purchase Requisitions' },
  PropsSection: (pageProps) => ({ gutter: pageProps.gutter })
}
