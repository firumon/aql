import { computed } from 'vue'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { buildOutletDeliveryQueue } from 'src/_resource/Operation/OutletDeliveries/composables/useOutletDeliveryQueue'
import { ageColor } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

export function useDeliveryQueueContext () {
  const nav = useResourceNav()
  const ui = useAQLConfig()

  const restockItems = usePageRecord('OutletRestockItems')
  const restocks = usePageRecord('OutletRestocks')
  const deliveries = usePageRecord('OutletDeliveries')
  const outlets = usePageRecord('Outlets')
  const skus = usePageRecord('SKUs')
  const products = usePageRecord('Products')

  const { skuLabelText } = useSkuResource()

  const outletGroups = computed(() => buildOutletDeliveryQueue({
    restockItems: restockItems.items.value,
    restocks: restocks.items.value,
    deliveries: deliveries.items.value,
    outlets: outlets.items.value,
    skuLabelText
  }))

  const totals = computed(() => ({
    outlets: outletGroups.value.length,
    items: outletGroups.value.reduce((sum, group) => sum + group.itemCount, 0),
    units: outletGroups.value.reduce((sum, group) => sum + group.unitCount, 0)
  }))

  async function preload () {
    await Promise.all(
      [restockItems, restocks, deliveries, outlets, skus, products].map((res) => res.reload()))
  }

  return { nav, ui, outletGroups, totals, preload, ageColor }
}
