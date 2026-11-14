<template>
  <q-banner v-if="activeList?.error" role="alert" class="bg-red-1 text-negative">{{ activeList.error.message }}</q-banner>
  <Transition v-else name="aql-list-view" mode="out-in">
    <div :key="`${resourceName}:${activeList?.name}`">
      <AppList clickable keep-page v-model:page="page" :items="rows" v-bind="itemProps" :loading="loading" @click="onRowClick">
        <template v-if="activeList?.view?.actions !== false" #btn="{ item }">
          <div @click.stop>
            <AdditionalActionsButtons v-bind="actionProps" :resource="resourceName" :record="item" mode="inline" />
          </div>
        </template>
      </AppList>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import AdditionalActionsButtons from 'components/app/AdditionalActionsButtons.vue'
import { useListView } from 'src/composables/resources/listViews/useListView'

defineOptions({ name: 'ContentsList', inheritAttrs: false })

const { activeList, loading, resourceName, page, itemProps, actionProps, onRowClick } = useListView()
const rows = computed(() => activeList.value?.rows ?? [])
</script>
