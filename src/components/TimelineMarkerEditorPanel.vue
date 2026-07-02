<script setup lang="ts">
  import { GripHorizontal, Trash2, TriangleAlert, X } from '@lucide/vue'
  import ClearableInput from '@/components/ClearableInput.vue'
  import ClearableSelect from '@/components/ClearableSelect.vue'
  import TimeShortcutInput from '@/components/TimeShortcutInput.vue'
  import { formatDuration, isRangeMarker } from '@/utils/format'
  import type { MarkerType } from '@/types/api'
  import type { SelectOption, ShortcutMode, TimelineMarker } from '@/types/timeline'

  defineProps<{
    marker: TimelineMarker
    canEdit: boolean
    duration: number
    markerTypeOptions: SelectOption<MarkerType>[]
    mutationStatus: string
    mutationStatusClass: string
    conflictText: string
    startClock: string
    endClock: string
    endValue: number | null
    startShortcutModes: ShortcutMode[]
    endShortcutModes: ShortcutMode[]
  }>()

  const emit = defineEmits<{
    startDrag: [event: PointerEvent]
    remove: []
    close: []
    updateType: [value: MarkerType]
    updateTitle: [value: string | number | null]
    updateStart: [value: string | number | null]
    updateEnd: [value: string | number | null]
    commitEnd: []
  }>()

  function updateEndAndCommit(value: string | number | null) {
    emit('updateEnd', value)
    emit('commitEnd')
  }
</script>

<template>
  <div class="flex items-start justify-between gap-3">
    <div class="-m-2 min-w-0 flex-1 cursor-move select-none rounded-xl p-2 touch-none transition hover:bg-muted/70" @pointerdown="emit('startDrag', $event)">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="flex items-center gap-2 font-semibold text-ink">
          <GripHorizontal :size="16" class="text-ink/40" />
          编辑标记
        </h3>
        <span v-if="mutationStatus" class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="mutationStatusClass">
          {{ mutationStatus }}
        </span>
      </div>
      <p class="mt-1 text-xs text-ink/55">{{ formatDuration(marker.time_start) }} · Delete 删除 · 方向键微调</p>
    </div>
    <div class="flex shrink-0 gap-1">
      <button v-if="canEdit" type="button" class="icon-btn" aria-label="删除标记" @click="emit('remove')">
        <Trash2 :size="17" />
      </button>
      <button type="button" class="icon-btn" aria-label="关闭" @click="emit('close')">
        <X :size="17" />
      </button>
    </div>
  </div>

  <div v-if="conflictText" class="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
    <TriangleAlert :size="15" class="mt-0.5 shrink-0" />
    <span>{{ conflictText }}</span>
  </div>

  <div class="mt-4 grid gap-3">
    <ClearableSelect
      :model-value="marker.marker_type"
      label="类型"
      :options="markerTypeOptions"
      :disabled="!canEdit"
      :clearable="false"
      @update:model-value="emit('updateType', $event as MarkerType)"
    />
    <ClearableInput :model-value="marker.title" label="标题" placeholder="例如 开场、片尾、第一章" :disabled="!canEdit" @update:model-value="emit('updateTitle', $event)" />
    <div class="grid grid-cols-2 gap-3">
      <div>
        <div class="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium">
          <span class="text-ink/75">开始秒</span>
          <span class="shrink-0 font-mono text-xs text-ink/50">{{ startClock }}</span>
        </div>
        <ClearableInput :model-value="marker.time_start" type="number" :min="0" :max="duration" :disabled="!canEdit" @update:model-value="emit('updateStart', $event)" />
        <div class="mt-2">
          <TimeShortcutInput
            :model-value="marker.time_start"
            title="快捷输入开始时间"
            :modes="startShortcutModes"
            :duration="duration"
            :min="0"
            :max="duration"
            :disabled="!canEdit"
            @update:model-value="emit('updateStart', $event)"
          />
        </div>
      </div>
      <div v-if="isRangeMarker(marker.marker_type)">
        <div class="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium">
          <span class="text-ink/75">结束秒</span>
          <span class="shrink-0 font-mono text-xs text-ink/50">{{ endClock }}</span>
        </div>
        <ClearableInput :model-value="endValue" type="number" :min="0" :max="duration" :disabled="!canEdit" @update:model-value="emit('updateEnd', $event)" @blur="emit('commitEnd')" />
        <div class="mt-2">
          <TimeShortcutInput
            :model-value="marker.time_end"
            title="快捷输入结束时间"
            :modes="endShortcutModes"
            :anchor="marker.time_start"
            :duration="duration"
            :min="0"
            :max="duration"
            :disabled="!canEdit"
            @update:model-value="updateEndAndCommit"
          />
        </div>
      </div>
    </div>
  </div>
</template>
