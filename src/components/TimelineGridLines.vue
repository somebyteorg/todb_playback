<script setup lang="ts">
  import type { CSSProperties } from 'vue'
  import { formatDuration, markerTypeLabel } from '@/utils/format'
  import type { MarkerType } from '@/types/api'

  interface TimelineTick {
    time: number
    left: string
    showLabel: boolean
  }

  defineProps<{
    split: boolean
    rows: MarkerType[]
    ticks: TimelineTick[]
    rowStyle: (index: number) => CSSProperties
  }>()
</script>

<template>
  <div v-if="split" class="absolute inset-x-0 top-0">
    <div v-for="(type, index) in rows" :key="`row_${type}`" class="absolute left-0 right-0 h-10 border-t border-line/70" :style="rowStyle(index)">
      <span class="sr-only">{{ markerTypeLabel(type) }}</span>
    </div>
  </div>
  <div v-for="tick in ticks" :key="tick.time" class="absolute top-0 h-full border-l border-line/80" :style="{ left: tick.left }">
    <span v-if="tick.showLabel" class="absolute left-2 top-2 whitespace-nowrap text-[11px] font-medium text-ink/45">
      {{ formatDuration(tick.time) }}
    </span>
  </div>
</template>
