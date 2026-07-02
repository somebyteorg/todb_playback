<script setup lang="ts">
  import { ArchiveRestore, X } from '@lucide/vue'
  import { formatDuration, isRangeMarker, markerTypeLabel } from '@/utils/format'
  import type { MarkerType } from '@/types/api'

  export interface TimelineTrashItem {
    localId: string
    marker_id: number | null
    marker_type: MarkerType
    title: string | null
    time_start: number
    time_end: number | null
    source: string
    user_avatar: string | null
    user_nickname: string | null
  }

  defineProps<{
    open: boolean
    markers: TimelineTrashItem[]
    canBulkRestore: boolean
    markerColor: (type: MarkerType) => string
    sourceLabel: (source: string) => string
    avatarLabel: (marker: TimelineTrashItem) => string
  }>()

  const emit = defineEmits<{
    close: []
    restore: [marker: TimelineTrashItem]
    restoreAll: []
  }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 backdrop-blur-sm">
        <section class="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-panel p-5 shadow-soft">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-ink">回收站</h3>
              <p class="mt-1 text-sm text-ink/60">这里的删除内容在保存时间轴前可以恢复。</p>
            </div>
            <div class="flex shrink-0 gap-2">
              <button type="button" class="btn-secondary h-10" :disabled="!canBulkRestore" @click="emit('restoreAll')">
                <ArchiveRestore :size="16" />
                全部恢复
              </button>
              <button type="button" class="icon-btn" aria-label="关闭" @click="emit('close')">
                <X :size="17" />
              </button>
            </div>
          </div>

          <div v-if="markers.length === 0" class="empty-box mt-5">暂无删除内容。</div>
          <div v-else class="mt-5 grid gap-3">
            <article v-for="marker in markers" :key="`trash_${marker.localId}`" class="rounded-2xl border border-line bg-muted p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full px-2.5 py-1 text-xs font-semibold text-white" :class="markerColor(marker.marker_type)">
                      {{ markerTypeLabel(marker.marker_type) }}
                    </span>
                    <span v-if="marker.source === 'user'" class="inline-flex items-center gap-1.5 text-xs font-medium text-ink/60">
                      <img v-if="marker.user_avatar" :src="marker.user_avatar" :alt="marker.user_nickname || '用户'" class="h-5 w-5 rounded-full border border-line object-cover" />
                      <span v-else class="grid h-5 w-5 place-items-center rounded-full bg-primary/12 text-[10px] font-bold text-primary-strong">
                        {{ avatarLabel(marker) }}
                      </span>
                      <span class="max-w-28 truncate">{{ marker.user_nickname || '其他用户' }}</span>
                    </span>
                    <span v-else class="text-xs text-ink/55">{{ sourceLabel(marker.source) }}</span>
                  </div>
                  <h4 class="mt-3 line-clamp-1 font-semibold text-ink">{{ marker.title || markerTypeLabel(marker.marker_type) }}</h4>
                  <p class="mt-1 text-sm text-ink/60">
                    {{ formatDuration(marker.time_start) }}
                    <template v-if="isRangeMarker(marker.marker_type)"> - {{ formatDuration(marker.time_end ?? marker.time_start) }}</template>
                  </p>
                </div>
                <button type="button" class="btn-secondary shrink-0" @click="emit('restore', marker)">
                  <ArchiveRestore :size="16" />
                  恢复
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 160ms ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
