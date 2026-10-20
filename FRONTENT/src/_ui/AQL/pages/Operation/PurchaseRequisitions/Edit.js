export default {
  sections: ['PageHeader', 'EditLockBanner'],
  contents: ['RequisitionBasic', 'RequisitionItems', 'RequisitionReview', 'SubmitOptions'],
  PropsPageHeader: { title: 'Edit Purchase Requisition', reload: false },
  PropsRequisitionBasic: { step: 1 },
  PropsRequisitionItems: { step: 2 },
  PropsRequisitionReview: { step: 3 },
  PropsSubmitOptions: { step: 3 }
}
