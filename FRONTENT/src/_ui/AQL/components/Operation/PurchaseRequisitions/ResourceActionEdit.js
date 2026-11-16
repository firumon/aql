import { useAuth } from 'src/composables/core/useAuth'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { canEditRequisition } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

export default {
  show: (record) => canEditRequisition(record, useAuth().user.value?.id, {
    updateAllowed: useResourceConfig('PurchaseRequisitions').allowed('update', 'PurchaseRequisitions', record),
    rfqCreateAllowed: useResourceConfig('RFQs').allowed('create')
  }),
  label: 'Edit Requisition'
}
