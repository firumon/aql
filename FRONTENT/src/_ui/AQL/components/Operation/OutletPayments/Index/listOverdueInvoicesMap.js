import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

const text = value => (value == null ? '' : String(value).trim())

function overdueText (row) {
  const days = row?.dueInDays
  if (days === null || days === undefined) return 'No due date'
  if (days >= 0) return 'Due today'
  return `Due ${Math.abs(days)} days ago`
}

export default function (row) {
  const { _C } = useCurrencyResource()
  return {
    displayOverdueText: overdueText(row),
    displayOverdueOutlet: text(row.outletName) || text(row.outletCode),
    displayOverdueCaption: [text(row.date), text(row.username)].filter(Boolean).join(' • '),
    displayOverdueBalance: _C(row.balance, true)
  }
}
