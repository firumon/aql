export default {
  sections: ['PageHeader'],
  contents: ['SelectRequisition', 'RevisionComments', 'RequisitionDetails', 'RequisitionItems'],

  PropsPageHeader: {
    title: 'Revise Purchase Requisition',
    reload: false
  },

  ready ({ pageState }) {
    pageState.resetForResource('PurchaseRequisitions')
  }
}
