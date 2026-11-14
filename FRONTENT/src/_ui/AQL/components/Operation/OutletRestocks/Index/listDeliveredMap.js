import { stampOf } from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

export default row => ({
  displayDeliveredRestockCaption: [row.Date, stampOf(row, 'ProgressDelivered').by]
    .filter(value => String(value ?? '').trim())
    .join(' • ')
})
