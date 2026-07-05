<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { Loader2, RefreshCw, Save, Trash2 } from '@lucide/vue'
  import ClearableInput from '@/components/ClearableInput.vue'
  import TimeShortcutInput from '@/components/TimeShortcutInput.vue'
  import Tooltip from '@/components/Tooltip.vue'
  import { useConfirmStore } from '@/stores/confirm'
  import { useToastStore } from '@/stores/toast'
  import { deleteVersion, updateVersion } from '@/utils/playback'
  import { formatDuration } from '@/utils/format'
  import type { PlaybackVersion } from '@/types/api'

  const props = withDefaults(
    defineProps<{
      version: PlaybackVersion
      canEdit: boolean
      canDelete?: boolean
      canSyncExternal?: boolean
      syncingExternal?: boolean
    }>(),
    {
      canDelete: false,
      canSyncExternal: false,
      syncingExternal: false,
    },
  )

  const emit = defineEmits<{
    updated: []
    deleted: []
    syncExternal: []
  }>()

  const confirm = useConfirmStore()
  const toast = useToastStore()
  const saving = ref(false)
  const form = ref<{
    name: string
    description: string
    runtime: number | null
  }>({
    name: props.version.name,
    description: props.version.description ?? '',
    runtime: props.version.runtime,
  })

  watch(
    () => props.version,
    (version) => {
      form.value = {
        name: version.name,
        description: version.description ?? '',
        runtime: version.runtime,
      }
    },
  )

  function clampRuntime(value: number) {
    return Math.min(60000, Math.max(60, Math.round(value)))
  }

  function setRuntime(value: string | number | null) {
    if (value === null || value === '') {
      form.value.runtime = null
      return
    }

    const runtime = Number(value)
    if (!Number.isFinite(runtime)) return
    form.value.runtime = clampRuntime(runtime)
  }

  async function save() {
    if (!props.canEdit || saving.value) return
    const runtime = form.value.runtime

    if (runtime === null || !Number.isFinite(runtime)) {
      toast.push('请填写版本时长', 'error')
      return
    }

    if (runtime < 60 || runtime > 60000) {
      toast.push('版本时长必须在 60 到 60000 秒之间', 'error')
      return
    }

    saving.value = true

    try {
      await updateVersion(props.version.version_id, {
        name: form.value.name || '默认',
        description: form.value.description || null,
        runtime,
      })
      emit('updated')
      toast.push('播放版本已保存', 'success')
    } finally {
      saving.value = false
    }
  }

  async function remove() {
    if (!props.canDelete) return
    const ok = await confirm.ask({
      title: '删除播放版本',
      message: `确认将删除当前版本: ${props.version.name}`,
      danger: true,
    })

    if (!ok) return
    await deleteVersion(props.version.version_id)
    toast.push('播放版本已删除', 'success')
    emit('deleted')
  }
</script>

<template>
  <section class="space-y-5">
    <div class="panel p-5">
      <div
        v-if="!canEdit"
        class="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
      >
        <p class="min-w-0">当前版本来自外部平台，版本信息不可在工作台编辑。</p>
        <Tooltip v-if="canSyncExternal" text="同步版本外部信息" placement="bottom">
          <button
            type="button"
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-amber-900 transition hover:bg-amber-200/70 hover:text-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/15 dark:text-amber-100 dark:hover:bg-amber-300/15"
            :disabled="syncingExternal"
            aria-label="同步版本外部信息"
            @click="emit('syncExternal')"
          >
            <Loader2 v-if="syncingExternal" :size="16" class="animate-spin" />
            <RefreshCw v-else :size="16" />
          </button>
        </Tooltip>
      </div>
      <div class="grid gap-4 md:grid-cols-3">
        <ClearableInput v-model="form.name" label="版本名" placeholder="默认" :disabled="!canEdit" />
        <div>
          <ClearableInput :model-value="form.runtime" label="版本时长秒" type="number" :min="60" :max="60000" :disabled="!canEdit" @update:model-value="setRuntime" />
          <div class="mt-2">
            <TimeShortcutInput :model-value="form.runtime" title="快捷输入版本时长" :min="60" :max="60000" :disabled="!canEdit" @update:model-value="setRuntime" />
          </div>
        </div>
        <div class="rounded-2xl border border-line bg-muted px-4 py-3">
          <span class="text-xs text-ink/50">当前版本的时长</span>
          <p class="mt-1 text-sm font-semibold text-ink">{{ formatDuration(form.runtime) || '未设置' }}</p>
        </div>
        <div class="md:col-span-3">
          <ClearableInput v-model="form.description" label="描述" textarea placeholder="例如 Netflix / 导演剪辑版" :disabled="!canEdit" />
        </div>
      </div>

      <div v-if="canEdit || canDelete" class="mt-5 flex flex-wrap justify-end gap-3">
        <button v-if="canDelete" type="button" class="btn-danger" @click="remove">
          <Trash2 :size="16" />
          删除版本
        </button>
        <button v-if="canEdit" type="button" class="btn-primary" :disabled="saving" @click="save">
          <Loader2 v-if="saving" :size="17" class="animate-spin" />
          <Save v-else :size="17" />
          更新版本信息
        </button>
      </div>
    </div>
  </section>
</template>
