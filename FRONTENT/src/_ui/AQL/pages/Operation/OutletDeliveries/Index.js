export default {
  sections: [
    'PageHeader',
    // Opens the item and restock sheets the widgets read; a cold cache must not read as "nothing waiting".
    'PreloadRows',
    'MetricCards',
    'LinearProgress',
    'AgeingBuckets',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsPageHeader: {
    title: 'Outlet Deliveries'
  }
}
