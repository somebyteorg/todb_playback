<script setup lang="ts">
  import { ArchiveRestore, Loader2, Plus, RotateCcw, Save, Trash2 } from '@lucide/vue'
  import ClearableSelect from '@/components/ClearableSelect.vue'
  import type { MarkerType } from '@/types/api'
  import type { SelectOption } from '@/types/timeline'

  defineProps<{
    canEdit: boolean
    loading: boolean
    saving: boolean
    resetting: boolean
    hasChanges: boolean
    selectedMarkerCount: number
    canBulkDelete: boolean
    trashedCount: number
    thumbnailPreviewEnabled: boolean
    hasPreviewSprites: boolean
    selectedSpriteId: number | null
    spriteSelectOptions: SelectOption<number>[]
    markerTypeOptions: SelectOption<MarkerType>[]
  }>()

  const emit = defineEmits<{
    toggleThumbnailPreview: []
    updateSelectedSprite: [value: string | number | null]
    bulkRemoveSelected: []
    openTrash: []
    resetMarkers: []
    saveMarkers: []
    addMarker: [type: MarkerType]
  }>()
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-xl font-semibold text-ink">时间轴</h2>
          <button
            type="button"
            class="hidden rounded-full border px-3 py-1.5 text-xs font-semibold transition md:inline-flex"
            :class="thumbnailPreviewEnabled ? 'border-primary/30 bg-primary/10 text-primary-strong' : 'border-line bg-panel text-ink/55 hover:text-ink'"
            :aria-pressed="thumbnailPreviewEnabled"
            :disabled="!hasPreviewSprites"
            @click="emit('toggleThumbnailPreview')"
          >
            预览图 {{ thumbnailPreviewEnabled ? '开' : '关' }}
          </button>
          <div v-if="thumbnailPreviewEnabled" class="hidden w-64 max-w-full md:block">
            <ClearableSelect
              :model-value="selectedSpriteId"
              :options="spriteSelectOptions"
              :clearable="false"
              :disabled="!hasPreviewSprites"
              @update:model-value="emit('updateSelectedSprite', $event)"
            />
          </div>
        </div>
      </div>

      <div v-if="canEdit" class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end lg:ml-auto">
        <button v-if="selectedMarkerCount" type="button" class="btn-danger px-3 text-xs sm:text-sm" :disabled="loading || saving || resetting || !canBulkDelete" @click="emit('bulkRemoveSelected')">
          <Trash2 :size="17" />
          删除选中
          <span class="rounded-full bg-white/20 px-1.5 text-xs text-white">{{ selectedMarkerCount }}</span>
        </button>
        <button type="button" class="btn-ghost px-3 text-xs sm:text-sm" :disabled="loading || saving || resetting" @click="emit('openTrash')">
          <ArchiveRestore :size="17" />
          回收站
          <span v-if="trashedCount" class="rounded-full bg-ink/10 px-1.5 text-xs text-ink/60">{{ trashedCount }}</span>
        </button>
        <button type="button" class="btn-ghost px-3 text-xs sm:text-sm" :disabled="loading || saving || resetting" @click="emit('resetMarkers')">
          <Loader2 v-if="resetting" :size="17" class="animate-spin" />
          <RotateCcw v-else :size="17" />
          重置
        </button>
        <button type="button" class="btn-primary px-3 text-xs sm:text-sm" :disabled="saving || resetting || !hasChanges" @click="emit('saveMarkers')">
          <Loader2 v-if="saving" :size="17" class="animate-spin" />
          <Save v-else :size="17" />
          保存时间轴
        </button>
      </div>
    </div>

    <div v-if="canEdit" class="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <button v-for="option in markerTypeOptions" :key="option.value" type="button" class="btn-ghost min-h-9 shrink-0 px-3 text-xs sm:min-h-10 sm:text-sm" @click="emit('addMarker', option.value)">
        <Plus :size="16" />
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
