import { buildRequisitionInitNodes } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'
import { useAuth } from 'src/composables/core/useAuth'

export default {
  sections: ['PageHeader'],
  contents: ['RequisitionBasic', 'RequisitionItems'],
  PropsPageHeader: { title: 'New Purchase Requisition', reload: false },
  PropsContent: (pageProps) => ({ gutter: pageProps.gutter }),
  ready ({ pageState }) {
    if (pageState.getControls('AddSeeded', false, 'PurchaseRequisitions') === true) return
    const { user } = useAuth()
    pageState.resetForResource('PurchaseRequisitions')
    pageState.applyNodes(buildRequisitionInitNodes({ actorName: user.value?.name || user.value?.email || '' }))
    pageState.setControls('AddSeeded', true, 'PurchaseRequisitions')
  }
}
