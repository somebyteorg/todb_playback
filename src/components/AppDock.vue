<script setup lang="ts">
  import { computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { BookOpen, Database, Home, KeyRound, LogIn, LogOut, Moon, Sun } from '@lucide/vue'
  import { useSignStore } from '@/stores/sign'
  import { ToSign } from '@/utils/api.ts'
  import Tooltip from '@/components/Tooltip.vue'

  const route = useRoute()
  const router = useRouter()
  const sign = useSignStore()

  const themeIcon = computed(() => (sign.is_dark ? Sun : Moon))

  async function logout() {
    await sign.signOut()
    if (route.meta.requiresAuth) {
      await router.push({ name: 'home' })
    }
  }

  function toggleTheme() {
    sign.setDarkMode(!sign.is_dark)
  }
</script>

<template>
  <aside class="fixed left-1/2 top-4 z-30 -translate-x-1/2 md:left-6 md:top-1/2 md:translate-x-0 md:-translate-y-1/2">
    <div class="flex max-w-[calc(100vw-2rem)] items-center gap-2 overflow-x-auto rounded-full border border-line bg-panel/90 p-2 shadow-soft backdrop-blur md:flex-col md:overflow-visible">
      <Tooltip text="首页" placement="right">
        <RouterLink :to="{ name: 'home' }" class="dock-btn" aria-label="首页">
          <Home :size="19" />
        </RouterLink>
      </Tooltip>
      <Tooltip text="浏览数据库" placement="right">
        <RouterLink :to="{ name: 'browse' }" class="dock-btn" aria-label="浏览数据库">
          <Database :size="19" />
        </RouterLink>
      </Tooltip>
      <Tooltip text="接口文档" placement="right">
        <RouterLink :to="{ name: 'docs' }" class="dock-btn" aria-label="开放文档">
          <BookOpen :size="19" />
        </RouterLink>
      </Tooltip>
      <Tooltip v-if="sign.isSignedIn" text="播放密钥" placement="right">
        <RouterLink :to="{ name: 'keys' }" class="dock-btn" aria-label="播放密钥">
          <KeyRound :size="19" />
        </RouterLink>
      </Tooltip>
      <Tooltip text="切换主题" placement="right">
        <button type="button" class="dock-btn" aria-label="切换主题" @click="toggleTheme">
          <component :is="themeIcon" :size="19" />
        </button>
      </Tooltip>
      <Tooltip v-if="sign.isSignedIn" text="退出" placement="right">
        <button type="button" class="dock-btn" aria-label="退出" @click="logout">
          <LogOut :size="19" />
        </button>
      </Tooltip>
      <Tooltip v-else text="登录" placement="right">
        <button type="button" class="dock-btn border border-primary/25 bg-primary/10 text-primary-strong hover:border-primary/40 hover:bg-primary/15" aria-label="登录" @click="ToSign">
          <LogIn :size="19" />
        </button>
      </Tooltip>
    </div>
  </aside>
</template>
