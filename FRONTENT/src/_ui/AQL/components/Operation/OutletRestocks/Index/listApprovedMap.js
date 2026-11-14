import { stampOf } from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

export default row => ({
  displayApprovedRestockCaption: [row.Date, stampOf(row, 'ProgressApproved').by]
    .filter(value => String(value ?? '').trim())
    .join(' • ')
})
