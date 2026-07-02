<script setup lang="ts">
  import { computed } from 'vue'
  import type { PlaybackVideoListItem } from '@/types/api'
  import { formatDate, imageUrl, videoTypeLabel } from '@/utils/format'

  const props = defineProps<{
    video: PlaybackVideoListItem
  }>()

  const backdrop = computed(() => imageUrl(props.video.image_backdrop, 'w500'))
  const bottomMeta = computed(() => {
    return [formatDate(props.video.date_air), videoTypeLabel(props.video.video_type), props.video.is_adult ? '成人' : ''].filter(Boolean).join(' - ')
  })
</script>

<template>
  <RouterLink
    :to="{ name: 'video-detail', params: { videoId: video.video_id } }"
    class="group relative block aspect-[16/10] overflow-hidden rounded-2xl border border-white/30 bg-ink/10 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-xl"
  >
    <img v-if="backdrop" :src="backdrop" :alt="video.video_title" class="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
    <div v-else class="absolute inset-0 bg-[linear-gradient(135deg,#BEEBE4,#FFE4B8_45%,#F8BBD0)]" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/35" />
    <div class="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
      <div class="min-w-0">
        <h2 class="line-clamp-1 text-lg font-semibold text-white">{{ video.video_title }}</h2>
        <p v-if="video.origin_title" class="mt-1 line-clamp-1 text-sm text-white/80">{{ video.origin_title }}</p>
        <p v-if="video.tagline" class="mt-1 line-clamp-1 text-sm text-white/70">{{ video.tagline }}</p>
      </div>
      <span v-if="video.runtime" class="shrink-0 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink">
        {{ video.runtime }} 分钟
      </span>
    </div>
    <p v-if="bottomMeta" class="absolute bottom-4 left-4 right-4 line-clamp-1 text-sm text-white/85">
      {{ bottomMeta }}
    </p>
  </RouterLink>
</template>
