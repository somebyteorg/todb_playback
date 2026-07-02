<script setup lang="ts">
  import { onMounted, reactive, ref, watch } from 'vue'
  import { useDebounceFn } from '@vueuse/core'
  import { Filter, Loader2, Search } from '@lucide/vue'
  import ClearableInput from '@/components/ClearableInput.vue'
  import ClearableSelect from '@/components/ClearableSelect.vue'
  import PaginationBar from '@/components/PaginationBar.vue'
  import VideoBackdropCard from '@/components/VideoBackdropCard.vue'
  import { listPlaybackVideos } from '@/utils/playback'
  import type { Paginated, PlaybackVideoListItem, VideoType } from '@/types/api'

  const pageSize = 9
  const loading = ref(false)
  const requestToken = ref(0)
  const filters = reactive<{
    video_type: VideoType | ''
    title: string
    has_version: '' | '0' | '1'
  }>({
    video_type: '',
    title: '',
    has_version: '',
  })
  const result = ref<Paginated<PlaybackVideoListItem>>({
    page: 1,
    page_size: pageSize,
    total: 0,
    items: [],
  })
  const videoTypeOptions = [
    { value: '', label: '全部类型' },
    { value: 'movie', label: '电影' },
    { value: 'tv', label: '电视' },
  ]
  const versionOptions = [
    { value: '', label: '全部版本' },
    { value: '1', label: '已有版本' },
    { value: '0', label: '暂无版本' },
  ]

  async function load(page = result.value.page) {
    const token = ++requestToken.value
    loading.value = true

    try {
      const data = await listPlaybackVideos({
        video_type: filters.video_type,
        title: filters.title,
        has_version: filters.has_version,
        page,
        page_size: pageSize,
      })

      if (token === requestToken.value) {
        result.value = data
      }
    } finally {
      if (token === requestToken.value) {
        loading.value = false
      }
    }
  }

  function submitFilters() {
    void load(1)
  }

  function runTitleSearchNow() {
    void load(1)
  }

  const debouncedTitleSearch = useDebounceFn(() => {
    void load(1)
  }, 450)

  watch(
    () => filters.title,
    (title, previousTitle) => {
      if (title === '' || (previousTitle === '' && title !== '')) {
        runTitleSearchNow()
        return
      }

      void debouncedTitleSearch()
    },
  )

  watch([() => filters.video_type, () => filters.has_version], () => {
    void load(1)
  })

  onMounted(() => {
    void load(1)
  })
</script>

<template>
  <main class="page-shell">
    <section class="mx-auto max-w-6xl px-5 py-10 md:px-8">
      <div>
        <h1 class="text-3xl font-black text-ink md:text-5xl">浏览数据库</h1>
        <p class="mt-4 max-w-2xl text-sm leading-7 text-ink/60">先选作品，再进详情。</p>
      </div>

      <form class="mt-8 rounded-3xl border border-line bg-panel p-4 shadow-soft md:p-5" @submit.prevent="submitFilters">
        <div class="grid items-end gap-3 md:grid-cols-[150px_1fr_170px_auto]">
          <ClearableSelect v-model="filters.video_type" label="类型" :options="videoTypeOptions" />
          <ClearableInput v-model="filters.title" label="标题" placeholder="搜索标题" />
          <ClearableSelect v-model="filters.has_version" label="播放版本" :options="versionOptions" />
          <div class="flex">
            <button type="submit" class="btn-primary h-[46px] w-full px-5" :disabled="loading">
              <Loader2 v-if="loading" :size="17" class="animate-spin" />
              <Search v-else :size="17" />
              搜索
            </button>
          </div>
        </div>
      </form>

      <div class="mt-8 flex items-center gap-2 text-sm text-ink/55">
        <Filter :size="16" />
        共 {{ result.total }} 条
      </div>

      <div v-if="loading" class="grid min-h-80 place-items-center text-ink/55">
        <Loader2 :size="30" class="animate-spin text-primary" />
      </div>
      <div v-else-if="result.items.length === 0" class="empty-box mt-8">没有找到符合条件的作品。</div>
      <div v-else class="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <VideoBackdropCard v-for="video in result.items" :key="video.video_id" :video="video" />
      </div>

      <div class="mt-8">
        <PaginationBar :page="result.page" :page-size="result.page_size" :total="result.total" :disabled="loading" @change="load" />
      </div>
    </section>
  </main>
</template>
