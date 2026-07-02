<script setup lang="ts">
  import { onMounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Loader2 } from '@lucide/vue'
  import { useSignStore } from '@/stores/sign'
  import { useToastStore } from '@/stores/toast'

  const route = useRoute()
  const router = useRouter()
  const sign = useSignStore()
  const toast = useToastStore()

  onMounted(async () => {
    const apiKey = typeof route.query.api_key === 'string' ? route.query.api_key : ''

    if (apiKey) {
      sign.setToken(apiKey)
      toast.push('登录成功', 'success')
    } else {
      toast.push('登录回调缺少 api_key', 'error')
    }

    await router.replace({ name: 'home' })
  })
</script>

<template>
  <main class="grid min-h-screen place-items-center px-5">
    <div class="text-center text-ink/70">
      <Loader2 :size="30" class="mx-auto animate-spin text-primary" />
      <p class="mt-4">正在处理登录状态</p>
    </div>
  </main>
</template>
