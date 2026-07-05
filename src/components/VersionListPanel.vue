<script setup lang="ts">
  import { computed } from 'vue'
  import { Link2, Loader2, LogIn, Play, Plus, X } from '@lucide/vue'
  import { formatDuration } from '@/utils/format'
  import type { PlaybackVersion } from '@/types/api'

  const props = withDefaults(
    defineProps<{
      mode?: 'inline' | 'dock'
      title?: string
      description: string
      versions: PlaybackVersion[]
      loading: boolean
      canCreate: boolean
      canClose?: boolean
      creatingDefault?: boolean
      canSyncExternal?: boolean
    }>(),
    {
      mode: 'inline',
      title: '版本列表',
      canClose: false,
      creatingDefault: false,
      canSyncExternal: false,
    },
  )

  const emit = defineEmits<{
    createDefault: []
    createCustom: []
    syncExternal: []
    close: []
    enter: [version: PlaybackVersion]
    signIn: []
  }>()

  const hasVersions = computed(() => props.versions.length > 0)
  const rootClass = computed(() => (props.mode === 'dock' ? 'mx-auto max-w-6xl rounded-3xl border border-line bg-panel/95 p-4 shadow-soft backdrop-blur-xl md:p-5' : 'panel p-5'))
  const loadingClass = computed(() => (props.mode === 'dock' ? 'grid h-24 place-items-center text-ink/55' : 'grid h-32 place-items-center text-ink/55'))
  const titleClass = computed(() => (props.mode === 'dock' ? 'text-lg font-semibold text-ink md:text-xl' : 'text-xl font-semibold text-ink'))
  const emptyClass = computed(() =>
    props.mode === 'dock'
      ? 'grid min-h-24 place-items-center rounded-2xl border border-dashed border-line p-5 text-center text-ink/60'
      : 'rounded-2xl border border-dashed border-line p-6 text-center text-ink/60',
  )
  const listClass = computed(() => (props.mode === 'dock' ? 'grid min-h-24 max-h-[42vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2' : 'space-y-3'))
  const bodyClass = computed(() => (props.mode === 'dock' ? 'mt-4 min-h-24' : 'mt-5'))
</script>

<template>
  <section :class="rootClass">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 :class="titleClass">{{ title }}</h2>
        <p class="mt-1 line-clamp-1 text-sm text-ink/60">{{ description }}</p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <button v-if="canSyncExternal" type="button" class="btn-secondary" :disabled="loading" @click="emit('syncExternal')">
          <Link2 :size="17" />
          同步外部信息
        </button>
        <button v-if="canCreate && !hasVersions" type="button" class="btn-primary" :disabled="creatingDefault || loading" @click="emit('createDefault')">
          <Loader2 v-if="creatingDefault" :size="17" class="animate-spin" />
          <Plus v-else :size="17" />
          创建默认版本
        </button>
        <button v-else-if="canCreate && hasVersions" type="button" class="btn-secondary" :disabled="loading" @click="emit('createCustom')">
          <Plus :size="17" />
          创建新版本
        </button>
        <button v-if="canClose" type="button" class="icon-btn" aria-label="隐藏版本列表" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>
    </div>

    <div :class="bodyClass">
      <div v-if="loading" :class="loadingClass">
        <Loader2 :size="24" class="animate-spin" />
      </div>

      <div v-else-if="versions.length === 0" :class="emptyClass">
        <div>
          <p>当前还没有播放版本。</p>
          <button v-if="!canCreate" type="button" class="btn-primary mx-auto mt-4" @click="emit('signIn')">
            <LogIn :size="17" />
            登录后创建默认版本
          </button>
        </div>
      </div>

      <div v-else :class="listClass">
        <button
          v-for="version in versions"
          :key="version.version_id"
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-muted px-4 py-3 text-left transition hover:border-primary/45"
          @click="emit('enter', version)"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-semibold text-ink">{{ version.name }}</h3>
              <span v-if="version.runtime" class="text-xs text-ink/55">{{ formatDuration(version.runtime) }}</span>
            </div>
            <p v-if="version.description" class="mt-1 line-clamp-1 text-sm text-ink/60">{{ version.description }}</p>
          </div>
          <Play :size="17" class="shrink-0 text-primary" />
        </button>
      </div>
    </div>
  </section>
</template>
