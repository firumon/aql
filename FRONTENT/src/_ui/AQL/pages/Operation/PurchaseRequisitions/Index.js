import { useAuth } from 'src/composables/core/useAuth'
import {
  recentPreset,
  draftsPreset,
  pendingApprovalPreset,
  needsRevisionPreset,
  approvedPreset,
  rfqProcessedPreset,
  rejectedPreset
} from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Index/usePurchaseRequisitionRowPresets'

export default {
  sections: [
    'PageHeader',
    'QueueCards',
    'SourcingCards',
    'ApprovalAgeing',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsListRecent: (props) => recentPreset(props.items),
  PropsListDrafts: (props) => draftsPreset(props.items, useAuth().user.value?.id),
  PropsListPendingApproval: (props) => pendingApprovalPreset(props.items),
  PropsListNeedsRevision: (props) => needsRevisionPreset(props.items),
  PropsListApproved: (props) => approvedPreset(props.items),
  PropsListRfqProcessed: (props) => rfqProcessedPreset(props.items),
  PropsListRejected: (props) => rejectedPreset(props.items)
}
