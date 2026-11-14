import { PARTIALLY_DELIVERED, progressOf, stampOf } from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

export default function (row) {
  const prefix = progressOf(row) === PARTIALLY_DELIVERED ? 'ProgressDelivered' : 'ProgressApproved'
  const comment = stampOf(row, prefix).comment
  return { displayPendingCompletionCaption: [row.Date, comment].filter(value => String(value ?? '').trim()).join(' • ') }
}
