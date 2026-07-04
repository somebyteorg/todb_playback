<script setup lang="ts">
  import dayjs from 'dayjs'
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { CalendarDays, Clapperboard, Loader2, Tv, X } from '@lucide/vue'
  import ClearableInput from '@/components/ClearableInput.vue'
  import EpisodeFilterControls from '@/components/EpisodeFilterControls.vue'
  import Tooltip from '@/components/Tooltip.vue'
  import VersionListPanel from '@/components/VersionListPanel.vue'
  import { useSignStore } from '@/stores/sign'
  import { useToastStore } from '@/stores/toast'
  import { ToSign } from '@/utils/api.ts'
  import { createDefaultVersion, createPlaybackVersion, getVideoDetail, listEpisodes, listSeasons, listVersions } from '@/utils/playback'
  import { formatDate, formatDuration, imageUrl, videoTypeLabel } from '@/utils/format'
  import type { EpisodeItem, PlaybackVersion, SeasonItem, VideoDetail } from '@/types/api'

  const route = useRoute()
  const router = useRouter()
  const sign = useSignStore()
  const toast = useToastStore()
  const videoId = computed(() => Number(route.params.videoId))
  const seasonNumber = computed(() => routeNumber(route.params.seasonNumber) ?? routeNumber(route.query.season_number))
  const episodeNumber = computed(() => routeNumber(route.params.episodeNumber) ?? routeNumber(route.query.episode_number))
  const detail = ref<VideoDetail | null>(null)
  const seasons = ref<SeasonItem[]>([])
  const episodes = ref<EpisodeItem[]>([])
  const versions = ref<PlaybackVersion[]>([])
  const selectedSeasonId = ref<number | null>(null)
  const selectedEpisodeId = ref<number | null>(null)
  const loading = ref(true)
  const seasonLoading = ref(false)
  const episodeLoading = ref(false)
  const versionLoading = ref(false)
  const creatingVersion = ref(false)
  const creatingCustomVersion = ref(false)
  const autoEntering = ref(false)
  const showCreateDialog = ref(false)
  const customVersionName = ref('')
  const onlyShowVersionedEpisodes = ref(false)
  const onlyShowReleasedEpisodes = ref(true)
  const versionDockOpen = ref(false)

  const selectedSeason = computed(() => seasons.value.find((item) => item.season_id === selectedSeasonId.value) ?? null)
  const selectedEpisode = computed(() => episodes.value.find((item) => item.episode_id === selectedEpisodeId.value) ?? null)
  const filteredEpisodes = computed(() => episodes.value.filter((episode) => episodeMatchesFilters(episode)))
  const backdrop = computed(() => imageUrl(detail.value?.image_backdrop, 'w780'))
  const poster = computed(() => imageUrl(detail.value?.image_poster, 'w500'))
  const contextReady = computed(() => {
    if (!detail.value) return false
    return detail.value.video_type === 'movie' || Boolean(selectedEpisode.value)
  })
  const showVersionDock = computed(() => detail.value?.video_type === 'tv' && versionDockOpen.value && contextReady.value)
  const versionPanelDescription = computed(() => {
    if (selectedEpisode.value) {
      return `第 ${selectedEpisode.value.episode_number} 集 · ${selectedEpisode.value.episode_title}`
    }

    return '只有当播放时长不同的时候，才需要创建新版本。'
  })

  function routeNumber(value: unknown) {
    const raw = Array.isArray(value) ? value[0] : value
    if (typeof raw !== 'string' || raw === '') return null
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null
    return parsed
  }

  function episodeRuntime(runtime: number) {
    return runtime < 600 ? runtime * 60 : runtime
  }

  function episodeMeta(episode: EpisodeItem) {
    return [formatDate(episode.date_air), episode.runtime ? formatDuration(episodeRuntime(episode.runtime)) : ''].filter(Boolean)
  }

  function hasEpisodeMeta(episode: EpisodeItem) {
    return Boolean(episode.date_air || episode.runtime)
  }

  function episodeHasVersions(episode: EpisodeItem) {
    return episode.playback_versions_count > 0
  }

  function episodeHasReleased(episode: EpisodeItem) {
    if (!episode.date_air) return false

    const airDate = dayjs(episode.date_air)
    return airDate.isValid() && !airDate.isAfter(dayjs(), 'day')
  }

  function episodeVersionText(episode: EpisodeItem) {
    return episodeHasVersions(episode) ? `${episode.playback_versions_count} 个版本` : '无版本'
  }

  function episodeMatchesReleaseFilter(episode: EpisodeItem) {
    return episodeHasReleased(episode) || episodeHasVersions(episode)
  }

  function episodeMatchesFilters(episode: EpisodeItem) {
    if (onlyShowVersionedEpisodes.value && !episodeHasVersions(episode)) return false
    if (onlyShowReleasedEpisodes.value && !episodeMatchesReleaseFilter(episode)) return false
    return true
  }

  function clearSelectedEpisode() {
    selectedEpisodeId.value = null
    versions.value = []
    versionDockOpen.value = false
  }

  function syncSelectedEpisodeWithFilters() {
    if (selectedEpisode.value && !episodeMatchesFilters(selectedEpisode.value)) {
      clearSelectedEpisode()
    }
  }

  function toggleVersionedEpisodesFilter() {
    onlyShowVersionedEpisodes.value = !onlyShowVersionedEpisodes.value
    syncSelectedEpisodeWithFilters()
  }

  function toggleReleasedEpisodesFilter() {
    onlyShowReleasedEpisodes.value = !onlyShowReleasedEpisodes.value
    syncSelectedEpisodeWithFilters()
  }

  function closeVersionDock() {
    versionDockOpen.value = false
  }

  function runtimeForDefaultVersion() {
    const runtime = selectedEpisode.value?.runtime ?? detail.value?.runtime ?? null
    if (!runtime) return null
    return runtime * 60
  }

  function versionQuery() {
    return {
      season_number: selectedSeason.value?.season_number ?? seasonNumber.value ?? undefined,
      episode_number: selectedEpisode.value?.episode_number ?? episodeNumber.value ?? undefined,
    }
  }

  async function enterWorkspace(version: PlaybackVersion) {
    if (autoEntering.value) return
    autoEntering.value = true

    await router.push({
      name: 'workspace',
      params: {
        videoId: videoId.value,
        versionId: version.version_id,
      },
      query: versionQuery(),
    })
  }

  async function loadVersionList() {
    if (!detail.value || !contextReady.value) return
    versionLoading.value = true

    try {
      const result = await listVersions({
        video_list_id: detail.value.video_id,
        video_season_id: detail.value.video_type === 'tv' ? selectedSeasonId.value : null,
        video_episode_id: detail.value.video_type === 'tv' ? selectedEpisodeId.value : null,
        page: 1,
        page_size: 50,
      })
      versions.value = result.items
    } finally {
      versionLoading.value = false
    }
  }

  async function chooseEpisode(episode: EpisodeItem) {
    selectedEpisodeId.value = episode.episode_id
    versions.value = []
    versionDockOpen.value = true
    await loadVersionList()
  }

  async function chooseSeason(season: SeasonItem, initialEpisodeNumber?: number | null) {
    selectedSeasonId.value = season.season_id
    selectedEpisodeId.value = null
    versions.value = []
    versionDockOpen.value = false
    episodeLoading.value = true

    try {
      episodes.value = await listEpisodes(videoId.value, season.season_id)
      const initialEpisode = initialEpisodeNumber !== null && initialEpisodeNumber !== undefined ? episodes.value.find((item) => item.episode_number === initialEpisodeNumber) : null
      if (initialEpisode) {
        if (episodeMatchesFilters(initialEpisode)) {
          await chooseEpisode(initialEpisode)
        }
      }
    } finally {
      episodeLoading.value = false
    }
  }

  async function enterDefaultVersion() {
    if (!detail.value || creatingVersion.value) return
    creatingVersion.value = true

    let runtime = runtimeForDefaultVersion()

    try {
      const response = await createDefaultVersion({
        video_list_id: detail.value.video_id,
        video_episode_id: detail.value.video_type === 'tv' ? selectedEpisodeId.value : null,
        runtime,
      })

      toast.push('默认播放版本已创建', 'success')
      await enterWorkspace({
        version_id: response.version_id,
        video_list_id: detail.value.video_id,
        video_season_id: detail.value.video_type === 'tv' ? selectedSeasonId.value : null,
        video_episode_id: detail.value.video_type === 'tv' ? selectedEpisodeId.value : null,
        name: '默认',
        description: null,
        runtime,
      })
    } finally {
      creatingVersion.value = false
    }
  }

  function openCreateDialog() {
    customVersionName.value = ''
    showCreateDialog.value = true
  }

  async function createCustomVersion() {
    if (!detail.value || creatingCustomVersion.value) return
    const name = customVersionName.value.trim().slice(0, 100)

    if (!name) {
      toast.push('请输入版本名称', 'error')
      return
    }

    creatingCustomVersion.value = true

    let runtime = runtimeForDefaultVersion()

    try {
      const response = await createPlaybackVersion({
        video_list_id: detail.value.video_id,
        video_episode_id: detail.value.video_type === 'tv' ? selectedEpisodeId.value : null,
        name,
        runtime,
      })

      toast.push('播放版本已创建', 'success')
      showCreateDialog.value = false
      customVersionName.value = ''
      await enterWorkspace({
        version_id: response.version_id,
        video_list_id: detail.value.video_id,
        video_season_id: detail.value.video_type === 'tv' ? selectedSeasonId.value : null,
        video_episode_id: detail.value.video_type === 'tv' ? selectedEpisodeId.value : null,
        name,
        description: null,
        runtime,
      })
    } finally {
      creatingCustomVersion.value = false
    }
  }

  async function loadPage() {
    loading.value = true

    try {
      const queryVersionId = routeNumber(route.query.version_id)
      if (queryVersionId) {
        await router.replace({
          name: 'workspace',
          params: { videoId: videoId.value, versionId: queryVersionId },
          query: versionQuery(),
        })
        return
      }

      detail.value = await getVideoDetail(videoId.value)

      if (detail.value.video_type === 'movie') {
        versionDockOpen.value = false
        await loadVersionList()
        return
      }

      seasonLoading.value = true
      seasons.value = await listSeasons(videoId.value)
      seasonLoading.value = false

      const initialSeason = seasonNumber.value !== null ? seasons.value.find((item) => item.season_number === seasonNumber.value) : null

      if (initialSeason) {
        await chooseSeason(initialSeason, episodeNumber.value)
      }
    } finally {
      loading.value = false
      seasonLoading.value = false
      episodeLoading.value = false
    }
  }

  onMounted(() => {
    void loadPage()
  })
</script>

<template>
  <main class="page-shell">
    <section v-if="loading" class="grid min-h-screen place-items-center text-ink/55">
      <Loader2 :size="32" class="animate-spin text-primary" />
    </section>

    <section v-else-if="detail" class="relative isolate" :class="showVersionDock ? 'pb-64 md:pb-56' : 'pb-12'">
      <img v-if="backdrop" :src="backdrop" :alt="detail.video_title" class="pointer-events-none fixed inset-0 z-0 h-screen w-screen object-cover" />
      <div class="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-page/15 via-page/70 to-page/100" />

      <div class="relative z-10 mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-8">
        <div class="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-center" :class="detail.video_type === 'tv' ? 'min-h-[clamp(300px,46vh,500px)]' : 'min-h-[clamp(360px,60vh,620px)]'">
          <div class="mx-auto w-full max-w-[190px] self-center sm:max-w-[230px] lg:max-w-none">
            <img v-if="poster" :src="poster" :alt="detail.video_title" class="aspect-[2/3] w-full rounded-2xl border border-white/50 object-cover shadow-soft" />
          </div>
          <div class="min-w-0 self-center rounded-3xl border border-white/25 bg-white/36 p-5 shadow-[0_18px_50px_rgba(40,51,70,0.10)] backdrop-blur-2xl md:p-6 dark:border-white/10 dark:bg-black/20">
            <div class="flex flex-wrap gap-2">
              <span class="badge">{{ videoTypeLabel(detail.video_type) }}</span>
              <span v-if="detail.is_adult" class="badge bg-rose-100 text-rose-700">成人</span>
              <span v-if="detail.date_air" class="badge">
                <CalendarDays :size="14" />
                {{ formatDate(detail.date_air) }}
              </span>
              <a :href="`https://theotherdb.org/video/${detail.video_id}`" target="_blank" rel="noreferrer noopener" class="badge hover:border-primary/45 hover:text-primary-strong">
                todbv-{{ detail.video_id }}
              </a>
            </div>
            <h1 class="mt-5 text-3xl font-black text-ink md:text-5xl">{{ detail.video_title }}</h1>
            <p v-if="detail.origin_title" class="mt-2 text-base text-ink/62">{{ detail.origin_title }}</p>
            <p v-if="detail.tagline" class="mt-3 text-sm font-medium text-primary-strong md:text-base">{{ detail.tagline }}</p>
            <p v-if="detail.video_description" class="mt-5 text-sm leading-7 text-ink/68 md:max-w-4xl">
              {{ detail.video_description }}
            </p>
          </div>
        </div>
      </div>

      <div class="relative z-10 mx-auto max-w-6xl space-y-6 px-5 md:px-8" :class="detail.video_type === 'tv' ? 'py-2 md:py-3' : 'py-5 md:py-6'">
        <section v-if="detail.video_type === 'tv'" class="grid gap-5 lg:grid-cols-[280px_1fr] lg:items-start">
          <div class="panel p-4 lg:sticky lg:top-6 lg:self-start">
            <div class="mb-4 flex items-center gap-2 font-semibold text-ink">
              <Tv :size="18" />
              选择季
            </div>
            <div v-if="seasonLoading" class="grid h-32 place-items-center text-ink/55">
              <Loader2 :size="24" class="animate-spin" />
            </div>
            <div v-else class="space-y-2">
              <button
                v-for="season in seasons"
                :key="season.season_id"
                type="button"
                class="w-full rounded-2xl border p-3 text-left transition"
                :class="selectedSeasonId === season.season_id ? 'border-primary bg-primary/10' : 'border-line bg-panel hover:border-primary/40'"
                @click="chooseSeason(season)"
              >
                <span class="font-semibold text-ink">{{ season.season_title }}</span>
                <span v-if="season.origin_title" class="mt-1 block line-clamp-1 text-xs text-ink/45">{{ season.origin_title }}</span>
                <span class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/55">
                  <span>{{ season.episode_count }} 集</span>
                  <span v-if="season.date_air" class="text-ink/30">/</span>
                  <span v-if="season.date_air">{{ formatDate(season.date_air) }}</span>
                </span>
              </button>
            </div>
          </div>

          <div class="panel p-4">
            <div class="mb-4 flex flex-wrap items-center gap-3">
              <div class="flex min-h-8 items-center gap-2 font-semibold text-ink">
                <Clapperboard :size="18" />
                选择集
              </div>
              <EpisodeFilterControls
                v-if="selectedSeason && !episodeLoading && episodes.length > 0"
                :versioned-only="onlyShowVersionedEpisodes"
                :released-only="onlyShowReleasedEpisodes"
                @toggle-versioned="toggleVersionedEpisodesFilter"
                @toggle-released="toggleReleasedEpisodesFilter"
              />
            </div>
            <div v-if="!selectedSeason" class="empty-box">先选择季。</div>
            <div v-else-if="episodeLoading" class="grid h-32 place-items-center text-ink/55">
              <Loader2 :size="24" class="animate-spin" />
            </div>
            <div v-else-if="episodes.length === 0" class="empty-box">当前季暂无剧集。</div>
            <div v-else-if="filteredEpisodes.length === 0" class="empty-box">当前筛选下暂无剧集。</div>
            <div v-else class="grid gap-3 md:grid-cols-2">
              <button
                v-for="episode in filteredEpisodes"
                :key="episode.episode_id"
                type="button"
                class="rounded-2xl border p-4 text-left transition"
                :class="selectedEpisodeId === episode.episode_id ? 'border-primary bg-primary/10' : 'border-line bg-panel hover:border-primary/40'"
                @click="chooseEpisode(episode)"
              >
                <div class="flex items-start justify-between gap-3">
                  <span class="text-xs font-semibold text-primary">第 {{ episode.episode_number }} 集</span>
                  <Tooltip :text="episodeVersionText(episode)" placement="left">
                    <span class="mt-1 block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/70 dark:ring-black/30" :class="episodeHasVersions(episode) ? 'bg-emerald-500' : 'bg-rose-400'" />
                  </Tooltip>
                </div>
                <Tooltip :text="episode.episode_title" as="div" placement="bottom" overflow-only class="mt-2 w-full min-w-0">
                  <h3 class="line-clamp-1 w-full min-w-0 font-semibold text-ink">{{ episode.episode_title }}</h3>
                </Tooltip>
                <p v-if="episode.origin_title" class="mt-1 line-clamp-1 text-xs text-ink/45">{{ episode.origin_title }}</p>
                <p v-if="hasEpisodeMeta(episode)" class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/55">
                  <template v-for="(meta, index) in episodeMeta(episode)" :key="meta">
                    <span v-if="index > 0" class="text-ink/30">/</span>
                    <span>{{ meta }}</span>
                  </template>
                </p>
              </button>
            </div>
          </div>
        </section>

        <VersionListPanel
          v-if="detail.video_type === 'movie'"
          :description="versionPanelDescription"
          :versions="versions"
          :loading="versionLoading"
          :can-create="sign.isSignedIn"
          :creating-default="creatingVersion"
          @create-default="enterDefaultVersion"
          @create-custom="openCreateDialog"
          @enter="enterWorkspace"
          @sign-in="ToSign"
        />
      </div>
    </section>

    <Teleport to="body">
      <Transition name="fade">
        <section v-if="showVersionDock" class="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 md:px-8">
          <VersionListPanel
            mode="dock"
            :description="versionPanelDescription"
            :versions="versions"
            :loading="versionLoading"
            :can-create="sign.isSignedIn"
            :can-close="true"
            :creating-default="creatingVersion"
            @create-default="enterDefaultVersion"
            @create-custom="openCreateDialog"
            @close="closeVersionDock"
            @enter="enterWorkspace"
            @sign-in="ToSign"
          />
        </section>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showCreateDialog" class="fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 backdrop-blur-sm">
          <section class="w-full max-w-lg rounded-3xl border border-line bg-panel p-5 shadow-soft">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold text-ink">创建新版本</h2>
                <p class="mt-2 text-sm leading-6 text-ink/65">只有当播放时长不同的时候，才需要创建新版本。</p>
              </div>
              <button type="button" class="icon-btn" @click="showCreateDialog = false">
                <X :size="16" />
              </button>
            </div>

            <div class="mt-5">
              <ClearableInput v-model="customVersionName" label="版本名称" placeholder="请输入版本名称" :maxlength="100" />
              <p class="mt-2 text-xs text-ink/50">最多 100 字符。</p>
            </div>

            <div class="mt-6 flex justify-end gap-3">
              <button type="button" class="btn-ghost" @click="showCreateDialog = false">取消</button>
              <button type="button" class="btn-primary" :disabled="creatingCustomVersion" @click="createCustomVersion">
                <Loader2 v-if="creatingCustomVersion" :size="17" class="animate-spin" />
                保存并进入
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 160ms ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
