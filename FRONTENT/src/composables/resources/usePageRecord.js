import { ref, computed, unref } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useRecord } from './useRecord'
import { useResourceConfig } from './useResourceConfig'
import { useRouteConfig } from './useRouteConfig'
import { singularize } from 'src/utils/appHelpers'

const resolveOverride = (override, fallback) =>
  override == null
    ? fallback
    : (typeof override === 'function' ? override() : unref(override)) || fallback

export function usePageRecord(resourceNameOverride, codeOverride) {
  const recordSource = useRecord()
  const authStore = useAuthStore()
  const resourceIo = useResourceIoStore()
  const { resourceName: routeResourceName } = useResourceConfig()
  const { code: routeCode } = useRouteConfig()

  const resourceName = computed(() => resolveOverride(resourceNameOverride, routeResourceName.value))

  const code = computed(() => resolveOverride(codeOverride, routeCode.value))

  const record = computed(() => {
    const name = resourceName.value
    const recordCode = code.value
    if (!name || !recordCode) return null
    return recordSource.enrich(name, recordCode)
  })

  const records = computed(() => {
    const name = resourceName.value
    if (!name) return []
    return recordSource.enriched(name)
  })

  const loading = ref(false)
  const loadRequestId = ref(0)

  async function reload() {
    const name = resourceName.value
    if (!name) return
    const requestId = ++loadRequestId.value
    const hasData = records.value.length > 0
    loading.value = !hasData
    try {
      await resourceIo.fetchResource(name)
      if (requestId !== loadRequestId.value) return
    } finally {
      if (requestId === loadRequestId.value) loading.value = false
    }
  }

  const relations = computed(() => {
    const name = resourceName.value
    if (!name) return null
    return recordSource.relations(name)
  })

  const allResources = computed(() =>
    Array.isArray(authStore.resources) ? authStore.resources : [])

  const childResources = computed(() => {
    const name = resourceName.value
    if (!name) return []
    const relChildren = (relations.value?.children || []).map(c => c.name)
    return allResources.value.filter(r =>
      r?.parentResource === name || relChildren.includes(r?.name))
  })

  const childRecordsByResource = computed(() => {
    const rec = record.value
    if (!rec) return {}
    const map = {}
    for (const key of rec._Children || []) {
      const childName = key.replace(/^\$/, '')
      if (Array.isArray(rec[key]) && rec[key].length) {
        map[childName] = rec[key]
      }
    }
    for (const childRes of childResources.value) {
      if (map[childRes.name]?.length) continue
      const parentCodeKey = singularize(resourceName.value) + 'Code'
      const matched = (recordSource.rows(childRes.name) || [])
        .filter(r => r[parentCodeKey] === rec.Code || r.ParentCode === rec.Code)
      if (matched.length) map[childRes.name] = matched
    }
    return map
  })

  const filterTerm = ref('')

  return {
    resourceName,
    code,

    record,
    records,
    items: records,

    loading,
    reload,

    relations,
    childResources,
    childRecordsByResource,

    filterTerm
  }
}
