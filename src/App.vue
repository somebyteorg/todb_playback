<template>
  <RouterView v-slot="{ Component, route }">
    <KeepAlive>
      <component :is="Component" v-if="route.meta.keepAlive" />
    </KeepAlive>
    <component :is="Component" v-if="!route.meta.keepAlive" />
  </RouterView>
  <AppDock />
  <ToastHost />
  <ConfirmDialog />
</template>

<script setup lang="ts">
  import { onMounted } from 'vue'
  import AppDock from '@/components/AppDock.vue'
  import ConfirmDialog from '@/components/ConfirmDialog.vue'
  import ToastHost from '@/components/ToastHost.vue'
  import { useSignStore } from '@/stores/sign'

  const sign = useSignStore()

  onMounted(() => {
    sign.setDarkMode(sign.is_dark)
  })
</script>
