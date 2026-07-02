<script setup lang="ts">
  import type { CSSProperties } from 'vue'
  import { GripHorizontal } from '@lucide/vue'
  import Tooltip from '@/components/Tooltip.vue'
  import { isRangeMarker, markerTypeLabel } from '@/utils/format'
  import type { MarkerType } from '@/types/api'
  import type { TimelineMarker } from '@/types/timeline'

  defineProps<{
    marker: TimelineMarker
    canEdit: boolean
    active: boolean
    selected: boolean
    conflicting: boolean
    changed: boolean
    markerColor: (type: MarkerType) => string
    markerStyle: CSSProperties
  }>()

  const emit = defineEmits<{
    select: [marker: TimelineMarker]
    startDrag: [event: PointerEvent, marker: TimelineMarker, mode: 'move' | 'start' | 'end']
  }>()
</script>

<template>
  <Tooltip
    :text="marker.title || markerTypeLabel(marker.marker_type)"
    placement="bottom"
    class="absolute h-9 rounded-full text-left text-xs font-semibold text-white shadow-md transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-white"
    :class="[markerColor(marker.marker_type), active ? 'ring-2 ring-white' : '', selected ? 'outline outline-2 outline-offset-2 outline-primary' : '', conflicting ? 'ring-2 ring-amber-300' : '']"
    :style="markerStyle"
  >
    <button
      type="button"
      class="flex h-full w-full items-center justify-center gap-1 rounded-full px-3 text-left text-inherit focus:outline-none"
      @click.stop="emit('select', marker)"
      @pointerdown="emit('startDrag', $event, marker, 'move')"
    >
      <GripHorizontal v-if="canEdit" :size="14" class="shrink-0" />
      <span class="line-clamp-1">{{ marker.title || markerTypeLabel(marker.marker_type) }}</span>
      <span v-if="changed" class="ml-1 h-2 w-2 shrink-0 rounded-full bg-white/85" />
    </button>
    <span
      v-if="canEdit && isRangeMarker(marker.marker_type)"
      class="absolute -left-1 top-1/2 h-6 w-3 -translate-y-1/2 rounded-full bg-white/80"
      @pointerdown.stop="emit('startDrag', $event, marker, 'start')"
    />
    <span
      v-if="canEdit && isRangeMarker(marker.marker_type)"
      class="absolute -right-1 top-1/2 h-6 w-3 -translate-y-1/2 rounded-full bg-white/80"
      @pointerdown.stop="emit('startDrag', $event, marker, 'end')"
    />
  </Tooltip>
</template>
