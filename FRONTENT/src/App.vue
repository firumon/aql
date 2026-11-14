<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useAuthLogic } from 'src/composables/core/useAuthLogic'
import { requestNotificationPermission, subscribeToPush } from 'src/utils/notifications'
import { initPwaWatcher } from 'src/composables/core/usePwaUpdate'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

onMounted(async () => {
  const authStore = useAuthStore()

  await initPwaWatcher()

  if (authStore.token) {
    authStore.notifyServiceWorker(authStore.token)
  }

  if (authStore.isAuthenticated) {
    // A reload skips login(), so the session bootstrap must run again here.
    await useAuthLogic().restoreSession()
  }

  if (VAPID_PUBLIC_KEY && authStore.token) {
    try {
      const granted = await requestNotificationPermission()
      if (granted) await subscribeToPush(VAPID_PUBLIC_KEY)
    } catch (error) {
      console.error('[App] Push subscription failed:', error)
    }
  }
})
</script>
