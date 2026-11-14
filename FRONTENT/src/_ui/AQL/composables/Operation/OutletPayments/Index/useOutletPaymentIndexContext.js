import { computed, inject } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useResourceReload } from 'src/composables/resources/useResourceReload'
import { listSearchText } from 'src/composables/resources/listViews/listViewSettings'
import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'

const text = (value) => (value == null ? '' : String(value).trim())

// Module-scoped so one page visit fires one load, however many lists call the relay.
let pending = null

export function useOutletPaymentIndexContext () {
  const nav = useResourceNav()
  const { reloadDependencies } = useResourceReload()

  const index = useOutletPaymentIndex()

  const resourceRecord = inject('resourceRecord', null)

  const filterTerm = computed(() => String(resourceRecord?.filterTerm?.value ?? '').trim().toLowerCase())

  const sources = ['OutletConsumptionInvoices', 'Outlets']

  const loadSources = () => reloadDependencies({ resources: sources, showError: false })

  if (!pending) {
    pending = loadSources().finally(() => { pending = null })
  }

  return {
    loadSources,
    nav,
    views: index.views,

    filterTerm,

    filterPayments: (rows) => {
      const keyword = filterTerm.value
      const list = Array.isArray(rows) ? rows : []
      if (!keyword) return list
      return list.filter((row) => listSearchText(row).includes(keyword))
    },

    openPayment: (code) => {
      const next = text(code)
      if (next) nav.goTo('view', { code: next })
    },

    startPayment: (outletCode, invoiceCode) => {
      const query = { outletCode: text(outletCode) }
      if (text(invoiceCode)) query.invoiceCode = text(invoiceCode)
      nav.goTo('add', { query })
    }
  }
}
