<script setup lang="ts">
  import { Layers, PanelTop, PieChart, UserRound } from '@lucide/vue'
  import type { MarkerType } from '@/types/api'
  import type { TimelineLayoutMode } from '@/types/timeline'

  interface MarkerTypeOption {
    value: MarkerType
    label: string
  }

  defineProps<{
    layoutMode: TimelineLayoutMode
    selfFilter: boolean
    selfMarkerCount: number
    typeFilters: MarkerType[]
    markerTypeOptions: MarkerTypeOption[]
    markerCounts: Record<MarkerType, number>
    zoom: number
    zoomOptions: number[]
    zoomPercent: string
    markerColor: (type: MarkerType) => string
  }>()

  const emit = defineEmits<{
    updateLayoutMode: [mode: TimelineLayoutMode]
    clearFilters: []
    toggleSelfFilter: []
    toggleTypeFilter: [type: MarkerType]
    setZoom: [value: number]
  }>()

  function zoomLabel(value: number) {
    return `${value * 100}%`
  }
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 xl:flex-nowrap">
    <div class="flex shrink-0 items-center gap-1 rounded-2xl border border-line bg-panel p-1.5 shadow-sm">
      <button
        type="button"
        class="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition"
        :class="layoutMode === 'merged' ? 'bg-ink text-panel shadow-sm' : 'text-ink/55 hover:bg-muted hover:text-ink'"
        aria-label="合并一行显示"
        @click="emit('updateLayoutMode', 'merged')"
      >
        <PanelTop :size="14" />
        合并
      </button>
      <button
        type="button"
        class="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition"
        :class="layoutMode === 'split' ? 'bg-ink text-panel shadow-sm' : 'text-ink/55 hover:bg-muted hover:text-ink'"
        aria-label="按类型分开显示"
        @click="emit('updateLayoutMode', 'split')"
      >
        <Layers :size="14" />
        分开
      </button>
    </div>

    <div class="flex min-w-0 items-center gap-1.5 xl:max-w-none xl:shrink-0">
      <div class="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-line bg-panel p-1.5 shadow-sm">
        <button
          type="button"
          class="grid h-8 w-8 shrink-0 place-items-center rounded-full transition"
          :class="typeFilters.length === 0 && !selfFilter ? 'bg-ink text-panel' : 'text-ink/45 hover:bg-muted hover:text-ink'"
          aria-label="全部类型"
          @click="emit('clearFilters')"
        >
          <PieChart :size="16" />
        </button>
        <button
          type="button"
          class="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition"
          :class="selfFilter ? 'bg-primary text-white shadow-sm' : 'text-ink/55 hover:bg-muted hover:text-ink'"
          :aria-pressed="selfFilter"
          @click="emit('toggleSelfFilter')"
        >
          <UserRound :size="14" />
          自己提交
          <span class="text-[10px] opacity-75">{{ selfMarkerCount }}</span>
        </button>
        <button
          v-for="option in markerTypeOptions"
          :key="`filter_${option.value}`"
          type="button"
          class="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition"
          :class="typeFilters.includes(option.value) ? `${markerColor(option.value)} text-white shadow-sm` : 'text-ink/55 hover:bg-muted hover:text-ink'"
          :aria-pressed="typeFilters.includes(option.value)"
          @click="emit('toggleTypeFilter', option.value)"
        >
          <span class="h-2 w-2 rounded-full" :class="markerColor(option.value)" />
          {{ option.label }}
          <span class="text-[10px] opacity-75">{{ markerCounts[option.value] }}</span>
        </button>
      </div>

      <div class="group relative">
        <button type="button" class="h-8 rounded-full px-2 text-xs font-semibold text-ink/45 transition hover:bg-muted hover:text-ink" aria-label="选择时间轴缩放比例">
          {{ zoomPercent }}
        </button>
        <div class="invisible absolute right-0 top-full z-40 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <div class="grid min-w-24 gap-1 rounded-2xl border border-line bg-panel p-1.5 shadow-soft">
            <button
              v-for="option in zoomOptions"
              :key="option"
              type="button"
              class="rounded-full px-3 py-1.5 text-left text-xs font-semibold transition"
              :class="zoom === option ? 'bg-primary text-white' : 'text-ink/60 hover:bg-muted hover:text-ink'"
              @click="emit('setZoom', option)"
            >
              {{ zoomLabel(option) }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
