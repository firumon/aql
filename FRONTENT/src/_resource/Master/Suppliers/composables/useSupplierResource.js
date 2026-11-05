import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'

const RESOURCE_NAME = 'Suppliers'
const text = (value) => String(value ?? '').trim()

export function useSupplierResource () {
  const source = useRecord()
  const shared = source.remember('Suppliers:choices', () => ({
    activeChoices: computed(() => source.enriched(RESOURCE_NAME)
      .filter((row) => text(row.Status || 'Active') === 'Active' && text(row.Code))
      .map((row) => ({
        row, code: text(row.Code), name: text(row.Name) || text(row.Code),
        country: text(row.Country), contact: text(row.ContactPerson),
        value: text(row.Code), label: text(row.Name) || text(row.Code)
      })))
  }))

  const getSupplier = (code) => {
    const key = text(code)
    return key ? source.recordBy(RESOURCE_NAME, 'Code', key) : null
  }

  return { ...shared, getSupplier }
}
