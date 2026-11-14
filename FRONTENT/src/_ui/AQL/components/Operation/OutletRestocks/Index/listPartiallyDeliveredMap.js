import { stampOf } from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

export default row => ({
  displayPartiallyDeliveredCaption: [row.Date, stampOf(row, 'ProgressDelivered').comment]
    .filter(value => String(value ?? '').trim())
    .join(' • ')
})
