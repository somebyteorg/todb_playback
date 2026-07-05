<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useClipboard } from '@vueuse/core'
  import { Copy, KeyRound, Loader2, Plus, Trash2 } from '@lucide/vue'
  import ClearableInput from '@/components/ClearableInput.vue'
  import Tooltip from '@/components/Tooltip.vue'
  import { useConfirmStore } from '@/stores/confirm'
  import { useToastStore } from '@/stores/toast'
  import { createPlaybackKey, deletePlaybackKey, listPlaybackKeys } from '@/utils/playback'
  import { formatDateTime } from '@/utils/format'
  import type { PlaybackKey } from '@/types/api'

  const confirm = useConfirmStore()
  const toast = useToastStore()
  const { copy } = useClipboard()
  const loading = ref(false)
  const creating = ref(false)
  const remark = ref('')
  const generatedKey = ref('')
  const keys = ref<PlaybackKey[]>([])
  const spritePlans = [
    {
      name: '免费',
      resolution: '< 640×360',
      access: '无需登录',
      toneClass: 'bg-muted text-ink/62 ring-line',
      markerClass: 'bg-ink/30',
    },
    {
      name: 'Plus',
      resolution: '>= 640×360',
      access: '1000 🥕/月',
      toneClass: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-200',
      markerClass: 'bg-amber-500',
    },
  ]

  async function loadKeys() {
    loading.value = true

    try {
      keys.value = await listPlaybackKeys()
    } finally {
      loading.value = false
    }
  }

  async function createKey() {
    if (creating.value) return
    creating.value = true

    try {
      const response = await createPlaybackKey(remark.value || null)
      generatedKey.value = response.key
      remark.value = ''
      toast.push('播放密钥已创建', 'success')
      await loadKeys()
    } finally {
      creating.value = false
    }
  }

  async function copyGeneratedKey() {
    if (!generatedKey.value) return
    await copy(generatedKey.value)
    toast.push('密钥已复制', 'success')
  }

  async function removeKey(key: PlaybackKey) {
    const ok = await confirm.ask({
      title: '删除播放密钥',
      message: `确认删除 #${key.key_id}？`,
      danger: true,
    })

    if (!ok) return
    await deletePlaybackKey(key.key_id)
    toast.push('播放密钥已删除', 'success')
    await loadKeys()
  }

  onMounted(() => {
    void loadKeys()
  })
</script>

<template>
  <main class="page-shell">
    <section class="mx-auto max-w-5xl px-5 py-10 md:px-8">
      <div>
        <h1 class="text-3xl font-black text-ink md:text-5xl">播放密钥</h1>
        <p class="mt-4 max-w-2xl text-sm leading-7 text-ink/60">让第三方支持并按账户权益解锁更多功能。</p>
      </div>

      <section class="mt-6 overflow-hidden rounded-3xl border border-line bg-panel shadow-soft" aria-labelledby="sprite-plan-title">
        <div class="border-b border-line px-5 py-5 md:px-6">
          <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div class="min-w-0">
              <div class="badge bg-muted">
                <KeyRound :size="16" />
                雪碧图权益
              </div>
              <h2 id="sprite-plan-title" class="mt-3 text-xl font-black text-ink md:text-2xl">按账户权益返回可用尺寸</h2>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-ink/58">不论是否携带播放密钥，640×360 以下尺寸均可免费使用。</p>
            </div>
          </div>
        </div>
        <div class="grid md:grid-cols-2">
          <article v-for="plan in spritePlans" :key="plan.name" class="relative min-w-0 border-t border-line p-5 transition hover:bg-muted/35 md:border-l md:border-t-0 md:first:border-l-0">
            <span class="absolute inset-x-0 top-0 h-1" :class="plan.markerClass" aria-hidden="true" />
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="text-sm font-black text-ink">{{ plan.name }}</h3>
              </div>
              <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1" :class="plan.toneClass">{{ plan.access }}</span>
            </div>
            <p class="mt-5 text-3xl font-black leading-none text-ink">{{ plan.resolution }}</p>
          </article>
        </div>
      </section>

      <div class="mt-8 grid gap-3 rounded-3xl border border-line bg-panel p-5 shadow-soft md:grid-cols-[1fr_auto] md:items-end">
        <ClearableInput v-model="remark" label="密钥备注" placeholder="例如 我的播放器" />
        <button type="button" class="btn-primary h-11 self-end" :disabled="creating" @click="createKey">
          <Loader2 v-if="creating" :size="17" class="animate-spin" />
          <Plus v-else :size="17" />
          新建密钥
        </button>
      </div>

      <div v-if="generatedKey" class="mt-4 rounded-2xl border border-line bg-panel p-4 shadow-soft">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <code class="break-all text-sm text-ink">{{ generatedKey }}</code>
          <button type="button" class="btn-secondary h-9" @click="copyGeneratedKey">
            <Copy :size="15" />
            复制密钥
          </button>
        </div>
      </div>

      <div v-if="loading" class="grid min-h-60 place-items-center text-ink/55">
        <Loader2 :size="28" class="animate-spin text-primary" />
      </div>
      <div v-else-if="keys.length === 0" class="empty-box mt-8">还没有播放密钥。</div>
      <div v-else class="mt-8 space-y-3">
        <article v-for="key in keys" :key="key.key_id" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3 shadow-sm">
          <div class="flex min-w-0 items-center gap-3">
            <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
              <KeyRound :size="18" />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="font-semibold text-ink">#{{ key.key_id }}</h2>
              </div>
              <p class="mt-1 text-sm text-ink/55">{{ key.key_remark || '无备注' }}</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm text-ink/55">
            <Tooltip :text="`创建于 ${formatDateTime(key.created_at)} 使用 ${key.count_use} 次`">
              <span>最近使用 {{ key.updated_at ? formatDateTime(key.updated_at) : '未使用' }}</span>
            </Tooltip>
            <button type="button" class="btn-danger h-9 px-3" @click="removeKey(key)">
              <Trash2 :size="15" />
              删除
            </button>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
