export default {
  sections: ['PageHeader', 'RFQHeader', 'Suppliers', 'Items', 'Requirements', 'Workflow'],
  contents: [],
  PropsSection: (pageProps) => ({ gutter: pageProps.gutter }),

  PropsPageHeader: {
    title: 'Request for Quotation',
    reload: false
  },
  PropsRFQHeader: { title: 'RFQ Details' },
  PropsSuppliers: { title: 'Suppliers' },
  PropsItems: { title: 'Items to Quote' },
  PropsRequirements: { title: 'Requirements' },
  PropsWorkflow: { title: 'Workflow Timeline' }
}
