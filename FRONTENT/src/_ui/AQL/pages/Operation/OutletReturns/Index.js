export default {
  sections: [
    'PageHeader',
    'MetricCards',
    'WorkflowFunnel',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsPageHeader: {
    title: 'Outlet Returns'
  },

  PropsSection: (pageProps) => ({ gutter: pageProps.gutter })
}
