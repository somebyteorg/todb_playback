<script setup lang="ts">
  import { type CSSProperties, nextTick, ref, watch } from 'vue'
  import { Clock3, X } from '@lucide/vue'
  import { formatClockTime } from '@/utils/format'

  interface ThumbnailPreviewImage {
    spriteId: number
    spriteName: string
    image: string
    width: string
    height: string
    backgroundSize: string
    backgroundPosition: string
  }

  interface PinnedThumbnailView {
    localId: string
    pinOrder: number
    time: number
    spriteId: number
    spriteName: string
    thumbnail: ThumbnailPreviewImage
    style: CSSProperties
    guideStyle: CSSProperties
  }

  const props = defineProps<{
    selected: boolean
    selectedPinId: string | null
    controls: PinnedThumbnailView[]
    pins: PinnedThumbnailView[]
    hoverShow: boolean
    hoverTime: number
    hoverThumbnail: ThumbnailPreviewImage | null
    hoverThumbnailStyle?: CSSProperties
  }>()

  const emit = defineEmits<{
    activatePin: [localId: string]
    unpin: [localId: string]
  }>()

  const controlsRef = ref<HTMLElement | null>(null)

  function previewTitle(time: number, spriteId: number, spriteName: string) {
    return `${formatClockTime(time)} · ${Math.max(0, Math.round(time))}s · ${spriteId}#${spriteName}`
  }

  watch(
    () => props.selectedPinId,
    (localId) => {
      if (!localId) return
      void nextTick(() => {
        const control = controlsRef.value?.querySelector<HTMLElement>(`[data-pin-id="${localId}"]`)
        control?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      })
    },
  )
</script>

<template>
  <div class="relative mb-3 pt-9">
    <div v-if="selected && controls.length" ref="controlsRef" class="absolute inset-x-0 top-0 flex h-8 items-center gap-1 overflow-x-auto px-1">
      <button
        v-for="pin in controls"
        :key="`${pin.localId}_control`"
        type="button"
        :data-pin-id="pin.localId"
        class="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-ink/75 px-2 text-[11px] font-bold text-white shadow-sm backdrop-blur transition hover:bg-primary"
        :class="selectedPinId === pin.localId ? 'ring-2 ring-primary/30' : ''"
        :aria-label="`置顶第 ${pin.pinOrder} 张预览图`"
        @click.stop="emit('activatePin', pin.localId)"
      >
        {{ pin.pinOrder }}
        <span
          v-if="selectedPinId === pin.localId"
          class="-mr-1 grid h-5 w-5 place-items-center rounded-full transition hover:bg-rose-500"
          aria-label="取消当前预览图 pin"
          @click.stop="emit('unpin', pin.localId)"
        >
          <X :size="13" />
        </span>
      </button>
    </div>

    <div class="relative h-[240px] overflow-hidden rounded-2xl border border-line bg-[linear-gradient(180deg,var(--timeline-top),var(--timeline-bottom))]">
      <template v-if="selected">
        <div v-for="pin in pins" :key="`${pin.localId}_preview_guide`" class="pointer-events-none absolute top-0 h-full border-l border-primary/45" :style="pin.guideStyle" />
        <div
          v-for="pin in pins"
          :key="pin.localId"
          class="absolute overflow-hidden rounded-xl bg-panel text-xs font-semibold text-white shadow-soft ring-1 ring-line"
          :style="pin.style"
          @click.stop="emit('activatePin', pin.localId)"
        >
          <span
            class="block bg-ink/10"
            :style="{
              width: pin.thumbnail.width,
              height: pin.thumbnail.height,
              backgroundImage: `url(${pin.thumbnail.image})`,
              backgroundSize: pin.thumbnail.backgroundSize,
              backgroundPosition: pin.thumbnail.backgroundPosition,
            }"
          />
          <span class="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded-full bg-ink/75 px-2.5 py-1 text-[11px] shadow-sm backdrop-blur">
            <Clock3 :size="13" />
            <span class="truncate">{{ previewTitle(pin.time, pin.spriteId, pin.spriteName) }}</span>
          </span>
        </div>
        <div
          v-if="hoverShow && hoverThumbnail"
          class="pointer-events-none absolute overflow-hidden rounded-xl bg-panel text-xs font-semibold text-white shadow-soft ring-1 ring-primary/35"
          :style="hoverThumbnailStyle"
        >
          <div
            class="bg-ink/10"
            :style="{
              width: hoverThumbnail.width,
              height: hoverThumbnail.height,
              backgroundImage: `url(${hoverThumbnail.image})`,
              backgroundSize: hoverThumbnail.backgroundSize,
              backgroundPosition: hoverThumbnail.backgroundPosition,
            }"
          />
          <div class="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded-full bg-ink/75 px-2.5 py-1 text-[11px] shadow-sm backdrop-blur">
            <Clock3 :size="13" />
            <span class="truncate">{{ previewTitle(hoverTime, hoverThumbnail.spriteId, hoverThumbnail.spriteName) }}</span>
          </div>
        </div>
      </template>
      <div v-else class="grid h-full place-items-center text-sm text-ink/55">还没有可用预览图</div>
    </div>
  </div>
</template>
