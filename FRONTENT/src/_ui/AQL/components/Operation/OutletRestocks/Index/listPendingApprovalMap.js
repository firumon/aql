import { stampOf } from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

export default row => ({
  displayPendingApprovalCaption: [row.RequestedUser, stampOf(row, 'ProgressSubmitted').comment]
    .filter(value => String(value ?? '').trim())
    .join(' • ')
})
