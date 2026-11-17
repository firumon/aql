export default {
  persist: false,
  sections: ['PageHeader'],
  contents: ['RFQSummary', 'AssignedSuppliers', 'AddSuppliers'],
  PropsContent: (pageProps) => ({ gutter: pageProps.gutter }),

  ready ({ pageState, routeInfo }) {
    pageState.reset()
    pageState.setControls('RFQCode', routeInfo?.value?.code || '')
    pageState.setControls('SelectedNewSupplierCodes', [])
    pageState.setControls('PendingSupplierStatuses', {})
    pageState.setControls('SupplierCancelReason', '')
  },

  PropsPageHeader: {
    title: 'Manage Suppliers',
    reload: false
  }
}
