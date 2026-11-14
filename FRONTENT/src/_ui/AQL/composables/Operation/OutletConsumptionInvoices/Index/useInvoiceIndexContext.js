import { computed, inject } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useResourceReload } from 'src/composables/resources/useResourceReload'
import { listSearchText } from 'src/composables/resources/listViews/listViewSettings'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import { canCreateInvoice } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

let pending = null

export function useInvoiceIndexContext () {
  const nav = useResourceNav()
  const { reloadDependencies } = useResourceReload()
  const ui = useAQLConfig()
  const { _C } = useCurrencyResource()

  const index = useInvoiceIndex()

  const resourceRecord = inject('resourceRecord', null)

  const filterTerm = computed(() => String(resourceRecord?.filterTerm?.value ?? '').trim().toLowerCase())

  const sources = ['OutletConsumptions', 'OutletConsumptionItems', 'OutletPayments', 'Outlets']

  const loadSources = () => reloadDependencies({ resources: sources, showError: false })

  if (!pending) {
    pending = loadSources().finally(() => { pending = null })
  }

  return {
    loadSources,
    ui,
    nav,
    money: (value) => _C(Number(value) || 0, true),

    outletPendings: index.outletPendings,
    invoiceableOutlets: index.invoiceableOutlets,
    storedViews: index.storedViews,

    filterTerm,

    filterInvoices: (rows) => {
      const keyword = filterTerm.value
      const list = Array.isArray(rows) ? rows : []
      if (!keyword) return list
      return list.filter((row) => listSearchText(row).includes(keyword))
    },

    canCreate: computed(() => canCreateInvoice()),

    openInvoice: (code) => {
      const next = String(code || '').trim()
      if (next) nav.goTo('view', { code: next })
    },

    startInvoice: (outletCode = '') => {
      const outlet = String(outletCode || '').trim()
      nav.goTo('add', outlet ? { query: { outletCode: outlet } } : {})
    }
  }
}

