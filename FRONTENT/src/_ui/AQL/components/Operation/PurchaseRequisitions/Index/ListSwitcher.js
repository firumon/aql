import { listSwitcherModifier } from 'src/_ui/AQL/composables/Operation/useListSwitcherGating'

export default listSwitcherModifier('PurchaseRequisitions', {
  Drafts: { any: ['create'] },
  NeedsRevision: { any: ['create'] }
})
