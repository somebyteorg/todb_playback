<script setup lang="ts">
  import { type Component, computed, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ArrowLeft, Image, Loader2, Pencil, TimerReset, X } from '@lucide/vue'
  import { HTTPError } from 'ky'
  import TimelineEditor from '@/components/TimelineEditor.vue'
  import SpritePanel from '@/components/SpritePanel.vue'
  import Tooltip from '@/components/Tooltip.vue'
  import VersionPanel from '@/components/VersionPanel.vue'
  import { useSignStore } from '@/stores/sign'
  import { useToastStore } from '@/stores/toast'
  import { getEpisodeDetail, getPlaybackVideoBase, listSprites, listVersions, syncExternalVersion } from '@/utils/playback'
  import { formatDate, formatDuration, videoTypeLabel } from '@/utils/format'
  import type { EpisodeDetail, ExternalRelationType, PlaybackVersion, PlaybackVideoBase, SpriteWithImages } from '@/types/api'

  type WorkspaceTab = 'timeline' | 'sprites'

  const route = useRoute()
  const router = useRouter()
  const sign = useSignStore()
  const toast = useToastStore()
  const videoId = computed(() => Number(route.params.videoId))
  const versionId = computed(() => Number(route.params.versionId))
  const seasonNumber = computed(() => routeNumber(route.query.season_number))
  const episodeNumber = computed(() => routeNumber(route.query.episode_number))
  const detail = ref<PlaybackVideoBase | null>(null)
  const episode = ref<EpisodeDetail | null>(null)
  const version = ref<PlaybackVersion | null>(null)
  const sprites = ref<SpriteWithImages[]>([])
  const loading = ref(true)
  const spritesLoading = ref(false)
  const activeTab = ref<WorkspaceTab>('timeline')
  const showVersionDialog = ref(false)
  const syncingExternalVersion = ref(false)

  const tabs: Array<{ value: WorkspaceTab; label: string; icon: Component }> = [
    { value: 'timeline', label: '时间轴', icon: TimerReset },
    { value: 'sprites', label: '预览图', icon: Image },
  ]

  const versionRuntime = computed(() => version.value?.runtime ?? null)
  const versionDurationText = computed(() => formatDuration(versionRuntime.value) || '未设置')
  const isExternalPlatformVersion = computed(() => Boolean(version.value && version.value.platform !== 'user'))
  const canEditWorkspace = computed(() => sign.isSignedIn && version.value?.platform === 'user')
  const canDeleteVersion = computed(() => sign.isSignedIn)
  const canSyncExternalVersion = computed(() => sign.isSignedIn && isExternalPlatformVersion.value)
  const externalSyncRelationType = computed<Extract<ExternalRelationType, 'video_list' | 'video_episode'>>(() => (detail.value?.video_type === 'tv' ? 'video_episode' : 'video_list'))
  const externalSyncRelationId = computed(() => {
    if (!detail.value || !version.value) return null
    if (detail.value.video_type === 'tv') return version.value.video_episode_id ?? episode.value?.episode_id ?? null
    return version.value.video_list_id || detail.value.video_id
  })
  const episodeCode = computed(() => {
    if (!episode.value || seasonNumber.value === null) return ''
    return `S${padEpisodeCodePart(seasonNumber.value)}E${padEpisodeCodePart(episode.value.episode_number)}`
  })
  const primaryTitle = computed(() => episode.value?.episode_title ?? detail.value?.video_title ?? '播放资料工作台')
  const secondaryTitle = computed(() => (episode.value && detail.value ? detail.value.video_title : ''))
  const officialRuntime = computed(() => normalizeRuntime(episode.value?.runtime ?? detail.value?.runtime ?? null))
  const detailRoute = computed(() => ({
    name: 'video-detail',
    params: { videoId: videoId.value },
    query: episode.value
      ? {
          season_number: seasonNumber.value ?? undefined,
          episode_number: episode.value.episode_number,
        }
      : undefined,
  }))

  function routeNumber(value: unknown) {
    const raw = Array.isArray(value) ? value[0] : value
    if (typeof raw !== 'string' || raw === '') return null
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null
    return parsed
  }

  function padEpisodeCodePart(value: number) {
    return String(value).padStart(2, '0')
  }

  function normalizeRuntime(value: number | null) {
    if (!value) return null
    return value < 600 ? value * 60 : value
  }

  async function backToDetail() {
    await router.push(detailRoute.value)
  }

  function fallbackVersion() {
    version.value = {
      version_id: versionId.value,
      video_list_id: videoId.value,
      video_season_id: episode.value?.season_id ?? null,
      video_episode_id: episode.value?.episode_id ?? null,
      platform: 'user',
      name: `#${versionId.value}`,
      description: null,
      runtime: null,
    }
  }

  async function loadCurrentVersion() {
    if (!detail.value) return

    const versionList = await listVersions({
      video_list_id: videoId.value,
      video_season_id: detail.value.video_type === 'tv' ? episode.value?.season_id : null,
      video_episode_id: detail.value.video_type === 'tv' ? episode.value?.episode_id : null,
      playback_version_id: versionId.value,
      page: 1,
      page_size: 1,
    })
    version.value = versionList.items.find((item) => item.version_id === versionId.value) ?? versionList.items[0] ?? null

    if (!version.value) fallbackVersion()
  }

  async function loadContext() {
    loading.value = true

    try {
      detail.value = await getPlaybackVideoBase(videoId.value)
      if (detail.value.video_type === 'tv') {
        if (seasonNumber.value === null || episodeNumber.value === null) {
          await router.replace({
            name: 'video-detail',
            params: { videoId: videoId.value },
          })
          return
        }

        try {
          episode.value = await getEpisodeDetail(videoId.value, seasonNumber.value, episodeNumber.value)
        } catch (error) {
          if (error instanceof HTTPError && error.response.status === 404) {
            await router.replace({
              name: 'video-detail',
              params: { videoId: videoId.value },
            })
            return
          }

          throw error
        }
      }

      await loadCurrentVersion()
      await loadSprites()
    } finally {
      loading.value = false
    }
  }

  async function loadSprites() {
    spritesLoading.value = true

    try {
      const items = await listSprites(versionId.value)
      sprites.value = items.map((item) => ({ ...item, images: [] }))
    } finally {
      spritesLoading.value = false
    }
  }

  function openVersionDialog() {
    if (!sign.isSignedIn) return

    showVersionDialog.value = true
  }

  async function submitExternalVersionSync() {
    if (!version.value || !canSyncExternalVersion.value || syncingExternalVersion.value) return

    const relationId = externalSyncRelationId.value
    if (!relationId) {
      toast.push('缺少关联 ID，无法同步版本信息', 'error')
      return
    }

    syncingExternalVersion.value = true

    try {
      await syncExternalVersion({
        type: version.value.platform,
        relation_type: externalSyncRelationType.value,
        relation_id: relationId,
      })
      toast.push('外部信息已保存，系统正在自动同步版本信息，预计约 3 分钟完成。', 'success')
    } finally {
      syncingExternalVersion.value = false
    }
  }

  async function onVersionDeleted() {
    await router.push(detailRoute.value)
  }

  async function onVersionUpdated() {
    showVersionDialog.value = false
    await loadCurrentVersion()
    await loadSprites()
  }

  onMounted(() => {
    void loadContext()
  })

  watch(activeTab, (tab) => {
    if (tab === 'sprites') void loadSprites()
  })
</script>

<template>
  <main class="page-shell">
    <section v-if="loading" class="grid min-h-screen place-items-center text-ink/55">
      <Loader2 :size="32" class="animate-spin text-primary" />
    </section>

    <section v-else-if="detail && version" class="pb-16">
      <div class="relative px-5 py-8 md:px-8 md:py-10">
        <div class="absolute inset-0 -z-10 bg-gradient-to-r from-page via-page/90 to-page/70" />
        <div class="mx-auto max-w-7xl">
          <button type="button" class="btn-ghost" @click="backToDetail">
            <ArrowLeft :size="17" />
            返回详情
          </button>
          <div class="mt-8 flex flex-col gap-6 rounded-[2rem] border border-white/35 bg-panel/55 p-5 shadow-soft backdrop-blur md:p-8">
            <div class="flex flex-wrap items-start justify-between gap-5">
              <div class="min-w-0">
                <div class="flex flex-wrap gap-2">
                  <span class="badge">{{ videoTypeLabel(detail.video_type) }}</span>
                  <a :href="`https://theotherdb.org/video/${detail.video_id}`" target="_blank" rel="noreferrer noopener" class="badge hover:border-primary/45 hover:text-primary-strong">
                    todbv-{{ detail.video_id }}
                  </a>
                </div>
                <RouterLink v-if="secondaryTitle" :to="detailRoute" class="mt-4 inline-flex text-sm font-semibold text-ink/58 transition hover:text-primary-strong">
                  {{ secondaryTitle }}
                </RouterLink>
                <h1 class="text-3xl font-black text-ink md:text-5xl" :class="secondaryTitle ? 'mt-2' : 'mt-4'">
                  {{ primaryTitle }}
                </h1>
                <div v-if="episodeCode || episode?.date_air" class="mt-3 flex flex-wrap items-center gap-2">
                  <span v-if="episodeCode" class="badge border-primary/25 bg-primary/10 text-primary-strong">{{ episodeCode }}</span>
                  <span v-if="episode?.date_air" class="text-sm font-semibold text-ink/55">{{ formatDate(episode.date_air) }}</span>
                </div>
              </div>

              <div class="flex shrink-0 items-start">
                <Tooltip v-if="version.description" :text="version.description">
                  <div class="flex items-center gap-3 rounded-2xl border border-line bg-panel/85 px-4 py-3 text-sm shadow-sm backdrop-blur">
                    <p class="font-semibold text-ink">版本: {{ version.name }} 时长: {{ versionDurationText }}</p>
                    <button
                      v-if="sign.isSignedIn"
                      type="button"
                      class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/60 transition hover:bg-muted hover:text-ink focus:outline-none focus:ring-4 focus:ring-primary/15"
                      aria-label="版本操作"
                      @click.stop="openVersionDialog"
                    >
                      <Pencil :size="16" />
                    </button>
                  </div>
                </Tooltip>
                <div v-else class="flex items-center gap-3 rounded-2xl border border-line bg-panel/85 px-4 py-3 text-sm shadow-sm backdrop-blur">
                  <p class="font-semibold text-ink">版本: {{ version.name }} 时长: {{ versionDurationText }}</p>
                  <button
                    v-if="sign.isSignedIn"
                    type="button"
                    class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/60 transition hover:bg-muted hover:text-ink focus:outline-none focus:ring-4 focus:ring-primary/15"
                    aria-label="版本操作"
                    @click="openVersionDialog"
                  >
                    <Pencil :size="16" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mx-auto max-w-7xl px-5 py-7 md:px-8">
        <div class="mb-6 flex gap-2 overflow-x-auto rounded-full border border-line bg-panel p-2 shadow-sm">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition"
            :class="activeTab === tab.value ? 'bg-primary text-white shadow-sm' : 'text-ink/60 hover:bg-muted hover:text-ink'"
            @click="activeTab = tab.value"
          >
            <component :is="tab.icon" :size="16" />
            {{ tab.label }}
          </button>
        </div>

        <TimelineEditor v-if="activeTab === 'timeline'" :version-id="version.version_id" :duration="versionRuntime" :can-edit="canEditWorkspace" :sprites="sprites" :video-type="detail.video_type" />

        <SpritePanel
          v-if="activeTab === 'sprites'"
          :version-id="version.version_id"
          :duration="versionRuntime"
          :can-edit="canEditWorkspace"
          :sprites="sprites"
          :loading="spritesLoading"
          @refresh="loadSprites"
        />
      </div>

      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showVersionDialog" class="fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 backdrop-blur-sm">
            <section class="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-line bg-panel p-5 shadow-soft md:p-6">
              <div class="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 class="text-lg font-semibold text-ink">编辑版本信息</h2>
                  <p class="mt-1 text-sm text-ink/60">当前视频的官方时长: {{ formatDuration(officialRuntime) || '未设置' }}</p>
                </div>
                <button type="button" class="icon-btn" aria-label="关闭" @click="showVersionDialog = false">
                  <X :size="17" />
                </button>
              </div>
              <VersionPanel
                :version="version"
                :can-edit="canEditWorkspace"
                :can-delete="canDeleteVersion"
                :can-sync-external="canSyncExternalVersion"
                :syncing-external="syncingExternalVersion"
                @sync-external="submitExternalVersionSync"
                @updated="onVersionUpdated"
                @deleted="onVersionDeleted"
              />
            </section>
          </div>
        </Transition>
      </Teleport>
    </section>
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
