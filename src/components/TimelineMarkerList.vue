<script setup lang="ts">
  import { CheckSquare, Square, Trash2 } from '@lucide/vue'
  import { formatDuration, isRangeMarker, markerTypeLabel } from '@/utils/format'
  import type { MarkerType } from '@/types/api'

  export interface TimelineMarkerListItem {
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
    markers: TimelineMarkerListItem[]
    canEdit: boolean
    markerColor: (type: MarkerType) => string
    markerStatus: (marker: TimelineMarkerListItem) => string
    markerStatusClass: (marker: TimelineMarkerListItem) => string
    isSelected: (marker: TimelineMarkerListItem) => boolean
    sourceLabel: (source: string) => string
    avatarLabel: (marker: TimelineMarkerListItem) => string
  }>()

  const emit = defineEmits<{
    select: [marker: TimelineMarkerListItem]
    toggleSelection: [marker: TimelineMarkerListItem]
    remove: [marker: TimelineMarkerListItem]
  }>()
</script>

<template>
  <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    <button
      v-for="marker in markers"
      :key="`list_${marker.localId}`"
      type="button"
      class="rounded-2xl border bg-panel p-4 text-left transition hover:border-primary/50"
      :class="isSelected(marker) ? 'border-primary/70 ring-2 ring-primary/10' : 'border-line'"
      @click="emit('select', marker)"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <button
            v-if="canEdit"
            type="button"
            class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/45 transition hover:bg-muted hover:text-primary-strong"
            :aria-label="isSelected(marker) ? '取消选择' : '选择标记'"
            @click.stop="emit('toggleSelection', marker)"
          >
            <CheckSquare v-if="isSelected(marker)" :size="16" />
            <Square v-else :size="16" />
          </button>
          <span class="rounded-full px-2.5 py-1 text-xs font-semibold text-white" :class="markerColor(marker.marker_type)">
            {{ markerTypeLabel(marker.marker_type) }}
          </span>
          <span v-if="markerStatus(marker)" class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="markerStatusClass(marker)">
            {{ markerStatus(marker) }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="marker.source === 'user'" class="inline-flex items-center gap-1.5 text-xs font-medium text-ink/60">
            <img v-if="marker.user_avatar" :src="marker.user_avatar" :alt="marker.user_nickname || '用户'" class="h-5 w-5 rounded-full border border-line object-cover" />
            <span v-else class="grid h-5 w-5 place-items-center rounded-full bg-primary/12 text-[10px] font-bold text-primary-strong">
              {{ avatarLabel(marker) }}
            </span>
            <span class="max-w-28 truncate">{{ marker.user_nickname || '其他用户' }}</span>
          </span>
          <span v-else class="text-xs text-ink/55">{{ sourceLabel(marker.source) }}</span>
          <button
            v-if="canEdit"
            type="button"
            class="grid h-7 w-7 place-items-center rounded-full text-ink/45 transition hover:bg-rose-500/10 hover:text-rose-600"
            aria-label="删除标记"
            @click.stop="emit('remove', marker)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </div>
      <h3 class="mt-3 line-clamp-1 font-semibold text-ink">{{ marker.title || markerTypeLabel(marker.marker_type) }}</h3>
      <p class="mt-1 text-sm text-ink/60">
        {{ formatDuration(marker.time_start) }}
        <template v-if="isRangeMarker(marker.marker_type)"> - {{ formatDuration(marker.time_end ?? marker.time_start) }}</template>
      </p>
    </button>
  </div>
</template>
