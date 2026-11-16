import { useRequisitionFormSeed } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'

export default {
  sections: ['PageHeader'],
  contents: ['RequisitionBasic', 'RequisitionItems'],
  PropsPageHeader: { title: 'Edit Purchase Requisition', reload: false },
  PropsContent: (pageProps) => ({ gutter: pageProps.gutter }),
  ready (ctx) {
    ctx.pageState.resetForResource('PurchaseRequisitions')
    useRequisitionFormSeed(ctx, 'edit')
  }
}
