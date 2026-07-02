<script setup lang="ts">
  import type { CSSProperties } from 'vue'
  import { markerTypeLabel } from '@/utils/format'
  import type { MarkerType } from '@/types/api'

  defineProps<{
    rows: MarkerType[]
    railStyle?: CSSProperties
    rowStyle: (index: number) => CSSProperties
    markerColor: (type: MarkerType) => string
  }>()
</script>

<template>
  <div class="sticky left-0 z-30 float-left mr-2 w-16 rounded-2xl border border-line bg-panel/95 backdrop-blur" :style="railStyle">
    <div v-for="(type, index) in rows" :key="`label_${type}`" class="absolute left-0 right-0 h-10" :style="rowStyle(index)">
      <span class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm" :class="markerColor(type)">
        {{ markerTypeLabel(type) }}
      </span>
    </div>
  </div>
</template>
