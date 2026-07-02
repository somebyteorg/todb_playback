<script setup lang="ts">
  import { ref } from 'vue'
  import { GripVertical, ImagePlus, ImageUp, Loader2, X } from '@lucide/vue'
  import type { SpriteAssetDraft } from '@/types/sprite'

  defineProps<{
    assets: SpriteAssetDraft[]
    pendingCount: number
    uploadedCount: number
    uploading: boolean
    dragAssetId: string | null
  }>()

  const emit = defineEmits<{
    fileChange: [event: Event]
    clear: []
    upload: []
    remove: [localId: string]
    dragStart: [asset: SpriteAssetDraft]
    dragEnd: []
    drop: [localId: string]
  }>()

  const fileInput = ref<HTMLInputElement | null>(null)

  function openFilePicker() {
    fileInput.value?.click()
  }
</script>

<template>
  <div class="mt-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <label class="block min-w-0 flex-1">
        <span class="mb-1.5 block text-sm font-medium text-ink/75">上传雪碧图</span>
        <span class="relative block">
          <input ref="fileInput" type="file" accept="image/avif, image/png, image/jpeg" multiple class="file_input field pr-11" @change="emit('fileChange', $event)" />
          <button
            v-if="assets.length"
            type="button"
            class="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink/45 transition hover:bg-ink/10 hover:text-ink"
            aria-label="清空预览图"
            @click="emit('clear')"
          >
            <X :size="15" />
          </button>
        </span>
      </label>
      <button type="button" class="btn-primary h-[46px]" :disabled="pendingCount === 0 || uploading" @click="emit('upload')">
        <Loader2 v-if="uploading" :size="17" class="animate-spin" />
        <ImageUp v-else :size="17" />
        批量上传
        <span v-if="pendingCount" class="rounded-full bg-white/20 px-1.5 text-xs text-white">{{ pendingCount }}</span>
      </button>
    </div>

    <div v-if="assets.length" class="mt-4 rounded-2xl border border-line bg-muted p-3">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-sm font-semibold text-ink">
          <ImagePlus :size="16" />
          待创建
        </div>
        <span class="text-xs text-ink/55">已上传 {{ uploadedCount }} / {{ assets.length }}</span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="(asset, index) in assets"
          :key="asset.localId"
          class="group rounded-2xl border border-line bg-panel p-3 shadow-sm transition"
          :class="dragAssetId === asset.localId ? 'opacity-50 ring-2 ring-primary/30' : ''"
          draggable="true"
          @dragstart="emit('dragStart', asset)"
          @dragend="emit('dragEnd')"
          @dragover.prevent
          @drop.prevent="emit('drop', asset.localId)"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <GripVertical :size="15" class="shrink-0 cursor-grab text-ink/35 group-active:cursor-grabbing" />
              <span class="truncate text-xs font-semibold text-ink/65">#{{ index + 1 }} {{ asset.file.name }}</span>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="asset.assetId ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'">
                {{ asset.assetId ? `ID ${asset.assetId}` : '未上传' }}
              </span>
              <button
                type="button"
                class="grid h-7 w-7 place-items-center rounded-full text-ink/45 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="移除资产"
                :disabled="asset.uploading || uploading"
                @click="emit('remove', asset.localId)"
              >
                <Loader2 v-if="asset.uploading" :size="14" class="animate-spin" />
                <X v-else :size="14" />
              </button>
            </div>
          </div>
          <div class="mt-3 aspect-video overflow-hidden rounded-xl border border-line bg-ink/10">
            <img :src="asset.previewUrl" alt="" class="h-full w-full object-contain" />
          </div>
        </article>
      </div>
    </div>
    <button
      v-else
      type="button"
      class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-muted px-4 py-8 text-sm font-semibold text-ink/55 transition hover:border-primary/45 hover:text-primary-strong"
      @click="openFilePicker"
    >
      <ImagePlus :size="18" />
      选择雪碧图文件
    </button>
  </div>
</template>
<style lang="css" scoped>
  .file_input::file-selector-button {
    display: none;
  }
</style>
