import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceStatusStore } from 'src/stores/resourceStatus'
import { useDataStore } from 'src/stores/data'
import { useResourceConfig } from './useResourceConfig.js'
import { usePageRecord } from './usePageRecord.js'

function normalizeName(value) {
  return (value || '').toString().trim()
}

export function useResourceReload() {
  const auth = useAuthStore()
  const resourceIo = useResourceIoStore()
  const resourceStatus = useResourceStatusStore()
  const dataStore = useDataStore()
  const { resourceName, scope } = useResourceConfig()
  const { parentResource, childResources } = usePageRecord(resourceName)

  const authorizedResources = computed(() => Array.isArray(auth.resources) ? auth.resources : [])

  const allowedResourceNames = computed(() => {
    const masterOnly = normalizeName(scope.value).toLowerCase() === 'master'
    return new Set(authorizedResources.value
      .filter((r) => !masterOnly || normalizeName(r?.scope).toLowerCase() === 'master')
      .map((r) => normalizeName(r?.name)).filter(Boolean))
  })

  const dependencyResourceNames = computed(() => {
    const names = new Set()
    const allowed = allowedResourceNames.value

    const addAllowed = (name) => {
      const clean = normalizeName(name)
      if (clean && allowed.has(clean)) {
        names.add(clean)
        return clean
      }
      return null
    }

    const current = addAllowed(resourceName.value)
    if (!current) return []

    addAllowed(parentResource.value?.name)

    const directChildren = new Set()
    childResources.value.forEach((child) => {
      const childName = addAllowed(child?.name)
      if (childName) directChildren.add(childName)
    })

    const currentRels = dataStore.getRelations(current)
    if (currentRels) {
      ;(currentRels.parents || []).forEach((p) => addAllowed(p.resourceName))
      ;(currentRels.children || []).forEach((c) => {
        const cName = addAllowed(c.name)
        if (cName) directChildren.add(cName)
      })
      Object.values(currentRels.linkRefs || {}).forEach((target) => addAllowed(target))
    }

    const childLinks = new Set()
    directChildren.forEach((childName) => {
      const childRels = dataStore.getRelations(childName)
      if (!childRels) return

      ;(childRels.parents || []).forEach((p) => {
        const pName = addAllowed(p.resourceName)
        if (pName) childLinks.add(pName)
      })
      Object.values(childRels.linkRefs || {}).forEach((target) => {
        const lName = addAllowed(target)
        if (lName) childLinks.add(lName)
      })
    })

    childLinks.forEach((refName) => {
      const refRels = dataStore.getRelations(refName)
      if (!refRels) return

      ;(refRels.parents || []).forEach((p) => addAllowed(p.resourceName))
      Object.values(refRels.linkRefs || {}).forEach((target) => addAllowed(target))
    })

    return Array.from(names)
  })

  const isAnyDependencySyncing = computed(() => {
    return dependencyResourceNames.value.some((name) => {
      return resourceStatus.isSyncing(name) ||
        dataStore.loadingByResource[name] === true ||
        dataStore.backgroundSyncingByResource[name] === true
    })
  })

  const hasUninitiatedDependencies = computed(() => {
    return dependencyResourceNames.value.some((name) => {
      return resourceStatus.byResource[name]?.initiated !== true
    })
  })

  function detectMissingLinkedResources(resources) {
    const missing = new Set()
    const depSet = new Set(resources)

    for (const sourceName of resources) {
      const records = dataStore.getRecords(sourceName)
      if (!records || !records.length) continue

      const rels = dataStore.getRelations(sourceName)
      if (!rels) continue

      const targetFieldMap = {}
      if (rels.linkRefs) {
        Object.entries(rels.linkRefs).forEach(([field, target]) => {
          if (target && depSet.has(target)) targetFieldMap[field] = target
        })
      }
      if (Array.isArray(rels.parents)) {
        rels.parents.forEach((p) => {
          if (p.codeField && p.resourceName && depSet.has(p.resourceName)) {
            targetFieldMap[p.codeField] = p.resourceName
          }
        })
      }
      if (rels.refs) {
        Object.entries(rels.refs).forEach(([field, refObj]) => {
          if (refObj?.resource && depSet.has(refObj.resource)) {
            targetFieldMap[field] = refObj.resource
          }
        })
      }

      for (const [field, targetResource] of Object.entries(targetFieldMap)) {
        const targetMap = dataStore.rows[targetResource]
        for (const record of records) {
          const val = record[field]
          if (val === undefined || val === null || val === '') continue

          const codes = (typeof val === 'string' && val.includes(','))
            ? val.split(',').map((s) => s.trim()).filter(Boolean)
            : [String(val).trim()]

          for (const code of codes) {
            if (!code) continue
            const exists = targetMap && (targetMap.has(code) || targetMap.has(String(code)))
            if (!exists) {
              missing.add(targetResource)
              break
            }
          }
          if (missing.has(targetResource)) break
        }
      }
    }

    return Array.from(missing)
  }

  async function reloadDependencies(options = {}) {
    const resources = dependencyResourceNames.value
    if (!resources.length) return { success: true, data: {}, error: null }

    const detectedMissing = detectMissingLinkedResources(resources)
    const combinedRecovery = Array.from(new Set([
      ...detectedMissing,
      ...(Array.isArray(options.recoveryResources) ? options.recoveryResources : [])
    ]))
    const recoverMissing = options.recoverMissing === true || combinedRecovery.length > 0

    return resourceIo.syncResources(resources, {
      showLoading: options.showLoading === true,
      showError: options.showError !== false,
      forceSync: true,
      recoverMissing,
      recoveryResources: combinedRecovery
    })
  }

  return {
    dependencyResourceNames,
    isAnyDependencySyncing,
    hasUninitiatedDependencies,
    reloadDependencies,
    detectMissingLinkedResources
  }
}
