import { buildRequisitionInitNodes } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useAuth } from 'src/composables/core/useAuth'

export default {
  sections: ['PageHeader'],
  contents: ['RequisitionBasic', 'RequisitionItems', 'RequisitionReview', 'SubmitOptions'],

  PropsPageHeader: {
    title: 'New Purchase Requisition',
    reload: false
  },

  ready ({ pageState }) {
    pageState.resetForResource('PurchaseRequisitions')
    pageState.initResource('Procurements')
    const { mainWarehouse } = useWarehouseResource()
    const whCode = mainWarehouse.value?.code || ''
    const { user } = useAuth()
    const resConfig = useResourceConfig('PurchaseRequisitions')
    const canApprove = resConfig.allowed('review', 'PurchaseRequisitions')

    pageState.applyNodes(buildRequisitionInitNodes({
      canApprove,
      isDraft: false,
      actorName: user.value?.name || user.value?.email || '',
      actorRole: user.value?.role || '',
      overrides: whCode ? { WarehouseCode: whCode } : {}
    }))
    pageState.meta.currentStep = 1
  },

  PropsRequisitionBasic: { step: 1 },
  PropsRequisitionItems: { step: 2 },
  PropsRequisitionReview: { step: 3 },
  PropsSubmitOptions: { step: 3 }
}
