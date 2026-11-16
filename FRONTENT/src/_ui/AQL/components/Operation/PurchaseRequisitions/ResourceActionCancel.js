import { useAuth } from 'src/composables/core/useAuth'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { canCancelRequisition } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

export default {
  show: (record) => canCancelRequisition(record, useAuth().user.value?.id, {
    cancelAllowed: useResourceConfig('PurchaseRequisitions').allowed('Cancel', 'PurchaseRequisitions', record),
    rfqCreateAllowed: useResourceConfig('RFQs').allowed('create')
  }),
  label: 'Cancel Requisition'
}
