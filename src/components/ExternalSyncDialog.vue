<script setup lang="ts">
  import dayjs from 'dayjs'
  import { computed, ref, watch } from 'vue'
  import { Link2, Loader2, RefreshCw, Save, X } from '@lucide/vue'
  import ClearableInput from '@/components/ClearableInput.vue'
  import ClearableSelect from '@/components/ClearableSelect.vue'
  import EpisodeExternalPicker from '@/components/EpisodeExternalPicker.vue'
  import Tooltip from '@/components/Tooltip.vue'
  import { useConfirmStore } from '@/stores/confirm'
  import { useToastStore } from '@/stores/toast'
  import {
    buildExternalEpisodeMatches,
    canAutoSaveExternalEpisodeMatch,
    countEpisodeDates,
    describeExternalEpisodeMatch,
    episodeCanKeepExistingMatch,
    externalEpisodeMatchRiskReasons,
  } from '@/utils/externalEpisodeMatch'
  import { formatDate, formatDuration } from '@/utils/format'
  import { listExternalRelations, spiderExternalEpisodes, updateExternalEpisodes, updateExternalVideo } from '@/utils/playback'
  import type { EpisodeItem, ExternalPlatform, ExternalRelationType, ExternalSpiderEpisodeAll, PlaybackExternalItem } from '@/types/api'
  import type { EpisodeMatchSource, ExternalEpisodeMatchState } from '@/utils/externalEpisodeMatch'

  type SyncMode = 'movie' | 'tv'
  type EpisodeChangeAction = 'none' | 'create' | 'update' | 'delete' | 'resync'
  type EpisodeReviewFilter = 'all' | 'needs_review' | 'risk' | 'date' | 'number' | 'missing_external' | 'mismatch' | 'delete'

  const props = withDefaults(
    defineProps<{
      open: boolean
      mode: SyncMode
      relationId: number | null
      title: string
      episodes?: EpisodeItem[]
    }>(),
    {
      episodes: () => [],
    },
  )

  const emit = defineEmits<{
    close: []
    saved: []
  }>()

  const toast = useToastStore()
  const confirm = useConfirmStore()
  const platformOptions: Array<{ value: ExternalPlatform; label: string }> = [
    { value: 'tencent', label: '腾讯' },
    { value: 'youku', label: '优酷' },
    { value: 'iqiyi', label: '爱奇艺' },
    { value: 'bilibili', label: 'B站' },
  ]

  const selectedPlatform = ref<ExternalPlatform>('tencent')
  const url = ref('')
  const loadingExisting = ref(false)
  const fetchingEpisodes = ref(false)
  const saving = ref(false)
  const existingRelations = ref<PlaybackExternalItem[]>([])
  const existingEpisodeRelations = ref<PlaybackExternalItem[]>([])
  const spiderResult = ref<ExternalSpiderEpisodeAll | null>(null)
  const episodeMatches = ref<Record<number, string | null>>({})
  const episodeMatchSources = ref<Record<number, EpisodeMatchSource>>({})
  const reviewFilter = ref<EpisodeReviewFilter>('all')

  const reviewFilterOptions: Array<{ value: EpisodeReviewFilter; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'needs_review', label: '需处理' },
    { value: 'risk', label: '高风险' },
    { value: 'date', label: '日期匹配' },
    { value: 'number', label: '集数匹配' },
    { value: 'missing_external', label: '外部值缺失' },
    { value: 'mismatch', label: '匹配异常' },
    { value: 'delete', label: '待删除' },
  ]

  let initializeVersion = 0
  let initializedKey = ''
  let spiderAbortController: AbortController | null = null

  const relationType = computed<ExternalRelationType>(() => (props.mode === 'tv' ? 'video_season' : 'video_list'))
  const dialogTitle = computed(() => (props.mode === 'tv' ? '同步季外部信息' : '同步电影外部信息'))
  const platformUrlPlaceholder = computed(() => {
    switch (selectedPlatform.value) {
      case 'tencent':
        return 'https://v.qq.com/x/cover/[x]/[x].html'
        break
      case 'youku':
        return 'https://v.youku.com/v_show/[x].html'
        break
      case 'iqiyi':
        return 'https://www.iqiyi.com/[x].html'
        break
      case 'bilibili':
        return 'https://www.bilibili.com/bangumi/media/[x].html'
        break
      default:
        return 'https://'
        break
    }
  })
  const spiderEpisodes = computed(() => spiderResult.value?.episodes ?? [])
  const externalByValue = computed(() => new Map(spiderEpisodes.value.map((episode) => [episode.external_value, episode])))
  const assignedEpisodesByValue = computed(() => {
    const assigned: Record<string, { episode_id: number; episode_number: number }> = {}

    props.episodes.forEach((episode) => {
      const externalValue = episodeMatches.value[episode.episode_id]
      if (!externalValue) return

      assigned[externalValue] = {
        episode_id: episode.episode_id,
        episode_number: episode.episode_number,
      }
    })

    return assigned
  })
  const selectedRelationExternal = computed(() => relationForSelectedPlatform(existingRelations.value, props.relationId))
  const selectedRelationExternalValue = computed(() => selectedRelationExternal.value?.external_value ?? '')
  const episodeMatchStates = computed<Record<number, ExternalEpisodeMatchState>>(() => {
    const states: Record<number, ExternalEpisodeMatchState> = {}

    props.episodes.forEach((episode) => {
      states[episode.episode_id] = describeExternalEpisodeMatch({
        episode,
        selectedValue: episodeMatches.value[episode.episode_id] ?? null,
        source: episodeMatchSources.value[episode.episode_id],
        externalByValue: externalByValue.value,
      })
    })

    return states
  })
  const changedEpisodePayloads = computed(() =>
    props.episodes
      .map((episode) => {
        if (episodeMatchState(episode).hasMissingExternalValue) return null
        const before = existingEpisodeExternalValue(episode.episode_id)
        const after = episodeMatches.value[episode.episode_id] ?? null

        if (before === after && !episodeNeedsVersionSyncRetry(episode, before, after)) return null

        return {
          video_episode_id: episode.episode_id,
          external_value: after,
        }
      })
      .filter((item): item is { video_episode_id: number; external_value: string | null } => item !== null),
  )
  const autoChangedEpisodePayloads = computed(() =>
    changedEpisodePayloads.value.filter((payload) => {
      const episode = props.episodes.find((item) => item.episode_id === payload.video_episode_id)
      if (!episode) return false
      return canAutoSaveExternalEpisodeMatch(episodeMatchState(episode))
    }),
  )
  const changedEpisodeCount = computed(() => changedEpisodePayloads.value.length)
  const deleteChangeCount = computed(() => changedEpisodePayloads.value.filter((payload) => payload.external_value === null).length)
  const episodeIdsKey = computed(() => props.episodes.map((episode) => episode.episode_id).join(','))
  const initializeKey = computed(() => {
    if (!props.open) return ''
    return [props.mode, props.relationId ?? '', episodeIdsKey.value].join('|')
  })
  const localDateCounts = computed(() => countEpisodeDates(props.episodes))
  const externalDateCounts = computed(() => countEpisodeDates(spiderEpisodes.value))
  const episodeSummary = computed(() => {
    let matched = 0
    let autoMatched = 0
    let dateMatched = 0
    let numberMatched = 0
    let missingExternal = 0
    let needsReview = 0
    let risk = 0

    props.episodes.forEach((episode) => {
      const state = episodeMatchState(episode)

      if (state.needsReview) {
        needsReview += 1
      }

      if (episodeHasRisk(episode)) {
        risk += 1
      }

      if (!state.selectedValue) return

      matched += 1
      if (state.hasMissingExternalValue) missingExternal += 1

      if (state.reason === 'date' || state.reason === 'number') {
        autoMatched += 1
      }

      if (state.reason === 'date') dateMatched += 1
      if (state.reason === 'number') numberMatched += 1
    })

    return {
      matched,
      autoMatched,
      dateMatched,
      numberMatched,
      missingExternal,
      needsReview,
      risk,
      total: props.episodes.length,
      externalTotal: spiderEpisodes.value.length,
    }
  })
  const visibleEpisodes = computed(() => {
    if (reviewFilter.value === 'needs_review') return props.episodes.filter((episode) => episodeMatchState(episode).needsReview)
    if (reviewFilter.value === 'risk') return props.episodes.filter((episode) => episodeHasRisk(episode))
    if (reviewFilter.value === 'date') return props.episodes.filter((episode) => episodeMatchState(episode).reason === 'date')
    if (reviewFilter.value === 'number') return props.episodes.filter((episode) => episodeMatchState(episode).reason === 'number')
    if (reviewFilter.value === 'missing_external') return props.episodes.filter((episode) => episodeMatchState(episode).hasMissingExternalValue)
    if (reviewFilter.value === 'mismatch') return props.episodes.filter((episode) => episodeMatchState(episode).hasMatchMismatch)
    if (reviewFilter.value === 'delete') return props.episodes.filter((episode) => episodeChangeAction(episode) === 'delete')

    return props.episodes
  })
  const unreleasedUnmatchedEpisodes = computed(() => {
    return props.episodes.filter((episode) => episodeIsUnreleased(episode) && episodeMatchSources.value[episode.episode_id] === 'unmatched')
  })
  const unreleasedUnmatchedPreview = computed(() => unreleasedUnmatchedEpisodes.value.slice(0, 8))
  const unreleasedUnmatchedOverflow = computed(() => Math.max(0, unreleasedUnmatchedEpisodes.value.length - unreleasedUnmatchedPreview.value.length))

  watch(initializeKey, (key) => {
    if (!key) {
      initializedKey = ''
      abortSpiderRequest()
      resetDialogState()
      return
    }

    if (key === initializedKey) return
    initializedKey = key
    void initialize()
  })

  watch(selectedPlatform, () => {
    if (!props.open) return
    applySelectedPlatformUrl(true)
    clearSpiderResult()
  })

  function normalizeExternalType(type: string) {
    return type.toLowerCase().replace(/^platform_/, '')
  }

  function externalPlatformFromRelation(relation: PlaybackExternalItem) {
    const normalizedType = normalizeExternalType(relation.type)
    const platform = platformOptions.find((item) => item.value === normalizedType)

    return platform?.value ?? null
  }

  function relationHasExternalData(relation: PlaybackExternalItem) {
    return Boolean(relation.url?.trim() || relation.external_value?.trim())
  }

  function firstExistingPlatform(relations: PlaybackExternalItem[], relationIds?: Set<number>) {
    for (const relation of relations) {
      if (relationIds && !relationIds.has(relation.relation_id)) continue
      if (!relationHasExternalData(relation)) continue

      const platform = externalPlatformFromRelation(relation)
      if (platform) return platform
    }

    return null
  }

  function relationForSelectedPlatform(relations: PlaybackExternalItem[], relationId: number | null) {
    if (relationId === null) return null

    return relations.find((item) => item.relation_id === relationId && normalizeExternalType(item.type) === selectedPlatform.value) ?? null
  }

  function resetDialogState() {
    initializeVersion += 1
    selectedPlatform.value = 'tencent'
    url.value = ''
    loadingExisting.value = false
    fetchingEpisodes.value = false
    saving.value = false
    existingRelations.value = []
    existingEpisodeRelations.value = []
    reviewFilter.value = 'all'
    clearSpiderResult()
  }

  function clearSpiderResult() {
    spiderResult.value = null
    episodeMatches.value = {}
    episodeMatchSources.value = {}
    reviewFilter.value = 'all'
  }

  function abortSpiderRequest() {
    spiderAbortController?.abort()
    spiderAbortController = null
  }

  async function initialize() {
    const version = ++initializeVersion

    abortSpiderRequest()
    clearSpiderResult()
    url.value = ''
    existingRelations.value = []
    existingEpisodeRelations.value = []

    if (!props.relationId) return

    loadingExisting.value = true

    try {
      const episodeRelationIds = props.mode === 'tv' ? props.episodes.map((episode) => episode.episode_id) : []
      const [relations, episodeRelations] = await Promise.all([
        listExternalRelations(relationType.value, [props.relationId]),
        episodeRelationIds.length > 0 ? listExternalRelations('video_episode', episodeRelationIds) : Promise.resolve([]),
      ])

      if (version !== initializeVersion || !props.open) return

      existingRelations.value = relations
      existingEpisodeRelations.value = episodeRelations
      selectedPlatform.value = firstExistingPlatform(relations, new Set([props.relationId])) ?? firstExistingPlatform(episodeRelations, new Set(episodeRelationIds)) ?? 'tencent'
      applySelectedPlatformUrl(true)
    } catch {
      // apiJson already displays the request error.
    } finally {
      if (version === initializeVersion) {
        loadingExisting.value = false
      }
    }
  }

  function applySelectedPlatformUrl(force: boolean) {
    const nextUrl = normalizeExternalUrl(selectedRelationExternal.value?.url ?? '')

    if (force || !url.value.trim()) {
      url.value = nextUrl
    }
  }

  function normalizeExternalUrl(value: string | null | undefined) {
    const raw = (value ?? '').trim()
    if (!raw) return ''

    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`

    try {
      const parsed = new URL(withScheme)
      parsed.search = ''
      return parsed.toString()
    } catch {
      const queryIndex = raw.indexOf('?')
      return queryIndex === -1 ? raw : raw.slice(0, queryIndex)
    }
  }

  function usableUrl() {
    const normalized = normalizeExternalUrl(url.value)

    try {
      const parsed = new URL(normalized)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('invalid protocol')
      }

      url.value = normalized
      return normalized
    } catch {
      toast.push('请输入有效的网址', 'error')
      return null
    }
  }

  function normalizeUrlInput() {
    url.value = normalizeExternalUrl(url.value)
  }

  function isAbortError(error: unknown) {
    return error instanceof Error && error.name === 'AbortError'
  }

  function notifyExternalSyncQueued() {
    toast.push('外部信息已保存，系统正在自动同步版本信息，预计约 3 分钟完成。', 'success')
  }

  async function saveMovie() {
    if (!props.relationId || saving.value) return

    const normalized = usableUrl()
    if (!normalized) return

    saving.value = true

    try {
      await updateExternalVideo({
        type: selectedPlatform.value,
        url: normalized,
        video_list_id: props.relationId,
      })
      notifyExternalSyncQueued()
      emit('saved')
      emit('close')
    } finally {
      saving.value = false
    }
  }

  async function fetchExternalEpisodes() {
    if (fetchingEpisodes.value) return

    const normalized = usableUrl()
    if (!normalized) return

    clearSpiderResult()
    fetchingEpisodes.value = true
    spiderAbortController = new AbortController()
    const controller = spiderAbortController

    try {
      const result = await spiderExternalEpisodes(selectedPlatform.value, normalized, controller.signal)
      spiderResult.value = result
      buildInitialEpisodeMatches(result)
    } catch (error) {
      if (isAbortError(error)) {
        toast.push('已取消获取外部剧集', 'info')
      }
    } finally {
      if (spiderAbortController === controller) {
        spiderAbortController = null
      }
      fetchingEpisodes.value = false
    }
  }

  function cancelFetch() {
    abortSpiderRequest()
  }

  function existingEpisodeExternalValue(episodeId: number) {
    return relationForSelectedPlatform(existingEpisodeRelations.value, episodeId)?.external_value ?? null
  }

  function buildInitialEpisodeMatches(result: ExternalSpiderEpisodeAll) {
    const existingValuesByEpisodeId: Partial<Record<number, string | null>> = {}

    props.episodes.forEach((episode) => {
      existingValuesByEpisodeId[episode.episode_id] = existingEpisodeExternalValue(episode.episode_id)
    })

    const next = buildExternalEpisodeMatches({
      episodes: props.episodes,
      externalEpisodes: result.episodes,
      existingValuesByEpisodeId,
    })

    episodeMatches.value = next.matches
    episodeMatchSources.value = next.sources
  }

  function setEpisodeMatch(episodeId: number, nextValue: string | null) {
    const normalizedValue = nextValue || null
    const nextMatches = { ...episodeMatches.value }

    if (normalizedValue) {
      Object.entries(nextMatches).forEach(([otherEpisodeId, externalValue]) => {
        if (Number(otherEpisodeId) !== episodeId && externalValue === normalizedValue) {
          nextMatches[Number(otherEpisodeId)] = null
        }
      })
    }

    nextMatches[episodeId] = normalizedValue
    episodeMatches.value = nextMatches
    episodeMatchSources.value = {
      ...episodeMatchSources.value,
      [episodeId]: 'manual',
    }
  }

  function resetAutoMatches() {
    if (!spiderResult.value) return

    buildInitialEpisodeMatches(spiderResult.value)
    toast.push('已重置为自动匹配结果', 'success')
  }

  function clearUnmatchedEpisodes() {
    const nextMatches = { ...episodeMatches.value }
    const nextSources = { ...episodeMatchSources.value }
    let count = 0

    props.episodes.forEach((episode) => {
      const state = episodeMatchState(episode)
      if (!state.needsReview) return
      if (state.hasMissingExternalValue) return
      nextMatches[episode.episode_id] = null
      nextSources[episode.episode_id] = 'manual'
      count += 1
    })

    episodeMatches.value = nextMatches
    episodeMatchSources.value = nextSources
    toast.push(count > 0 ? `已清空 ${count} 条需处理关联` : '没有需要清空的关联', count > 0 ? 'success' : 'info')
  }

  async function saveEpisodeMatches(scope: 'all' | 'auto' = 'all') {
    if (!spiderResult.value || saving.value) return
    if (!props.relationId) {
      toast.push('缺少季 ID，无法保存剧集关联', 'error')
      return
    }

    const payloads = scope === 'auto' ? autoChangedEpisodePayloads.value : changedEpisodePayloads.value

    if (payloads.length === 0) {
      toast.push(scope === 'auto' ? '没有自动匹配产生的变更' : '没有需要保存的剧集关联', 'info')
      return
    }

    const confirmed = await confirmRiskySave(payloads)
    if (!confirmed) return

    saving.value = true

    try {
      await updateExternalEpisodes({
        type: selectedPlatform.value,
        video_season_id: props.relationId,
        season_external_value: spiderResult.value.external_value,
        episodes: payloads,
      })
      notifyExternalSyncQueued()
      emit('saved')
      emit('close')
    } finally {
      saving.value = false
    }
  }

  async function confirmRiskySave(payloads: Array<{ video_episode_id: number; external_value: string | null }>) {
    const episodes = payloads.map((payload) => props.episodes.find((episode) => episode.episode_id === payload.video_episode_id)).filter((episode): episode is EpisodeItem => Boolean(episode))
    const deleteCount = payloads.filter((payload) => payload.external_value === null).length
    const riskCount = episodes.filter((episode) => episodeHasRisk(episode)).length

    if (deleteCount === 0 && riskCount === 0) return true

    const details = [deleteCount > 0 ? `${deleteCount} 条会删除外部关联` : '', riskCount > 0 ? `${riskCount} 条存在匹配风险` : ''].filter(Boolean)

    return confirm.ask({
      title: '确认保存关联',
      message: `本次保存包含${details.join('，')}。请确认已经核对这些剧集。`,
      danger: deleteCount > 0,
    })
  }

  function closeDialog() {
    abortSpiderRequest()
    emit('close')
  }

  function runtimeText(runtime: number | null | undefined) {
    if (!runtime) return ''

    return formatDuration(runtime < 600 ? runtime * 60 : runtime)
  }

  function metaText(dateAir: string | null | undefined, runtime: number | null | undefined) {
    return [formatDate(dateAir), runtimeText(runtime)].filter(Boolean).join(' / ') || '暂无'
  }

  function missingSelectedValue(episode: EpisodeItem) {
    const state = episodeMatchState(episode)
    if (!state.hasMissingExternalValue || !state.selectedValue) return ''

    return state.selectedValue
  }

  function selectedExternalEpisode(episode: EpisodeItem) {
    return episodeMatchState(episode).selectedExternalEpisode
  }

  function episodeMatchState(episode: EpisodeItem) {
    return (
      episodeMatchStates.value[episode.episode_id] ??
      describeExternalEpisodeMatch({
        episode,
        selectedValue: episodeMatches.value[episode.episode_id] ?? null,
        source: episodeMatchSources.value[episode.episode_id],
        externalByValue: externalByValue.value,
      })
    )
  }

  function episodeNeedsVersionSyncRetry(episode: EpisodeItem, before: string | null, after: string | null) {
    if (!before || !after || before !== after) return false
    if (episodeCanKeepExistingMatch(episode)) return false

    const source = episodeMatchSources.value[episode.episode_id]
    return source === 'date' || source === 'number' || source === 'manual'
  }

  function episodeRiskReasons(episode: EpisodeItem) {
    return externalEpisodeMatchRiskReasons({
      episode,
      state: episodeMatchState(episode),
      localDateCounts: localDateCounts.value,
      externalDateCounts: externalDateCounts.value,
      willDelete: episodeChangeAction(episode) === 'delete',
    })
  }

  function episodeHasRisk(episode: EpisodeItem) {
    return episodeRiskReasons(episode).length > 0
  }

  function episodeIsUnreleased(episode: EpisodeItem) {
    if (!episode.date_air) return false

    const airDate = dayjs(episode.date_air)
    return airDate.isValid() && airDate.isAfter(dayjs(), 'day')
  }

  function relationExplainText(episode: EpisodeItem) {
    const externalEpisode = selectedExternalEpisode(episode)
    const localText = `本地: ${episode.date_air || '无日期'} / 第 ${episode.episode_number} 集`

    if (!externalEpisode) {
      return `${localText} / 外部: 未关联`
    }

    return `${localText} / 外部: ${externalEpisode.date_air || '无日期'} / 第 ${externalEpisode.episode_number} 集`
  }

  function compactRiskText(episode: EpisodeItem) {
    const reasons = episodeRiskReasons(episode)
    if (reasons.length === 0) return ''
    if (reasons.length === 1) return reasons[0]

    return `${reasons[0]} 等 ${reasons.length} 项`
  }

  function episodeChangeAction(episode: EpisodeItem): EpisodeChangeAction {
    const before = existingEpisodeExternalValue(episode.episode_id)
    const after = episodeMatches.value[episode.episode_id] ?? null

    if (episodeNeedsVersionSyncRetry(episode, before, after)) return 'resync'
    if (before === after) return 'none'
    if (!after) return 'delete'
    if (!before) return 'create'
    return 'update'
  }

  function changeLabel(action: EpisodeChangeAction) {
    if (action === 'create') return '新增'
    if (action === 'update') return '更新'
    if (action === 'delete') return '删除'
    if (action === 'resync') return '同步'
    return '不变'
  }

  function changeClass(action: EpisodeChangeAction) {
    if (action === 'create') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
    if (action === 'update') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
    if (action === 'delete') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200'
    if (action === 'resync') return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200'
    return 'bg-muted text-ink/55'
  }

  function matchReason(episode: EpisodeItem) {
    const code = episodeMatchState(episode).reason

    if (code === 'unmatched') return '需要人工处理'
    if (code === 'none') return existingEpisodeExternalValue(episode.episode_id) ? '手动清除关联' : '未关联'
    if (code === 'existing') return '保留已有匹配'
    if (code === 'missing') return '保留当前值'
    if (code === 'date') return '按日期匹配'
    if (code === 'number') return '按集数匹配'
    return '手动关联'
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4 backdrop-blur-sm">
        <section class="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-visible rounded-3xl border border-line bg-panel shadow-soft">
          <header class="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div class="flex min-w-0 items-start gap-3">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                <Link2 :size="18" />
              </span>
              <div class="min-w-0">
                <h2 class="text-lg font-semibold text-ink">{{ dialogTitle }}</h2>
                <p class="mt-1 line-clamp-1 text-sm text-ink/60">{{ title }}</p>
              </div>
            </div>
            <button type="button" class="icon-btn" aria-label="关闭" @click="closeDialog">
              <X :size="16" />
            </button>
          </header>

          <div class="relative z-20 shrink-0 px-5 py-5">
            <div class="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <ClearableSelect v-model="selectedPlatform" label="平台" :options="platformOptions" :clearable="false" :disabled="loadingExisting || fetchingEpisodes || saving" />
              <ClearableInput v-model="url" label="平台网址" :placeholder="platformUrlPlaceholder" :disabled="loadingExisting || fetchingEpisodes || saving" @blur="normalizeUrlInput" />
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink/55">
              <span v-if="loadingExisting" class="inline-flex items-center gap-1.5">
                <Loader2 :size="14" class="animate-spin" />
                正在读取已有外部信息
              </span>
              <span v-else-if="selectedRelationExternalValue">当前外部值: {{ selectedRelationExternalValue }}</span>
              <span v-else>当前平台暂无外部关联</span>
            </div>

            <div v-if="fetchingEpisodes" class="mt-5 grid min-h-28 place-items-center rounded-2xl border border-line bg-muted text-center text-sm text-ink/62">
              <div>
                <Loader2 :size="24" class="mx-auto mb-3 animate-spin text-primary" />
                <p>正在获取平台剧集数据</p>
              </div>
            </div>
          </div>

          <div v-if="mode === 'tv' && spiderResult" class="relative z-10 min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            <section class="space-y-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 class="text-base font-semibold text-ink">{{ spiderResult.title || '外部剧集列表' }}</h3>
                  <p class="mt-1 text-sm text-ink/58">
                    共 {{ spiderEpisodes.length }} 条外部数据
                    <span v-if="spiderResult.episode_all"> / 平台总集数 {{ spiderResult.episode_all }}</span>
                    <span> / {{ changedEpisodeCount }} 条待保存</span>
                  </p>
                </div>
                <span class="badge max-w-full truncate">external_value: {{ spiderResult.external_value }}</span>
              </div>

              <div class="space-y-3 rounded-2xl border border-line bg-panel px-4 py-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/62">
                    <span
                      >已关联 <strong class="font-semibold text-ink">{{ episodeSummary.matched }}/{{ episodeSummary.total }}</strong></span
                    >
                    <span
                      >自动 <strong class="font-semibold text-ink">{{ episodeSummary.autoMatched }}</strong></span
                    >
                    <span :class="episodeSummary.needsReview > 0 ? 'text-amber-600 dark:text-amber-200' : ''"
                      >需处理 <strong class="font-semibold">{{ episodeSummary.needsReview }}</strong></span
                    >
                    <span :class="episodeSummary.risk > 0 ? 'text-rose-600 dark:text-rose-200' : ''"
                      >风险 <strong class="font-semibold">{{ episodeSummary.risk }}</strong></span
                    >
                    <span
                      >待保存 <strong class="font-semibold text-ink">{{ changedEpisodeCount }}</strong></span
                    >
                    <span v-if="deleteChangeCount" class="text-rose-600 dark:text-rose-200"
                      >待删除 <strong class="font-semibold">{{ deleteChangeCount }}</strong></span
                    >
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="btn-secondary min-h-9 px-3 py-1.5 text-xs" :disabled="saving" @click="clearUnmatchedEpisodes">清空需处理</button>
                    <button type="button" class="btn-secondary min-h-9 px-3 py-1.5 text-xs" :disabled="saving" @click="resetAutoMatches">重置自动匹配</button>
                    <button type="button" class="btn-secondary min-h-9 px-3 py-1.5 text-xs" :disabled="saving || autoChangedEpisodePayloads.length === 0" @click="saveEpisodeMatches('auto')">
                      保存自动匹配
                    </button>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    v-for="filter in reviewFilterOptions"
                    :key="filter.value"
                    type="button"
                    class="min-h-8 rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink/60 transition hover:border-primary/50 hover:text-primary-strong"
                    :class="reviewFilter === filter.value ? 'border-primary/60 text-primary-strong' : ''"
                    @click="reviewFilter = filter.value"
                  >
                    {{ filter.label }}
                  </button>
                  <span class="ml-auto text-xs text-ink/45">外部 {{ episodeSummary.externalTotal }} 条</span>
                </div>
              </div>

              <div
                v-if="unreleasedUnmatchedEpisodes.length"
                class="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="font-semibold">未开播且外部未匹配</p>
                  <span class="text-xs opacity-75">{{ unreleasedUnmatchedEpisodes.length }} 条</span>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span
                    v-for="episode in unreleasedUnmatchedPreview"
                    :key="episode.episode_id"
                    class="inline-flex max-w-full items-center gap-1 rounded-full bg-panel/75 px-3 py-1 text-xs text-ink/75"
                  >
                    <span class="font-semibold">第 {{ episode.episode_number }} 集</span>
                    <span>{{ formatDate(episode.date_air) }}</span>
                    <span v-if="episode.episode_title" class="max-w-[180px] truncate">{{ episode.episode_title }}</span>
                  </span>
                  <span v-if="unreleasedUnmatchedOverflow" class="inline-flex items-center rounded-full bg-panel/75 px-3 py-1 text-xs text-ink/55"> 还有 {{ unreleasedUnmatchedOverflow }} 条 </span>
                </div>
              </div>

              <div v-if="props.episodes.length === 0" class="empty-box">当前季暂无本地剧集，无法建立关联。</div>
              <div v-else-if="visibleEpisodes.length === 0" class="empty-box">当前筛选下没有剧集。</div>

              <div v-else class="rounded-2xl border border-line">
                <div class="hidden grid-cols-[minmax(220px,1fr)_minmax(260px,1.45fr)_minmax(220px,1.05fr)] gap-4 rounded-t-2xl bg-muted px-4 py-3 text-xs font-semibold text-ink/55 md:grid">
                  <span>本地</span>
                  <span>外部关联</span>
                  <span>状态</span>
                </div>
                <div class="divide-y divide-line">
                  <article
                    v-for="episode in visibleEpisodes"
                    :key="episode.episode_id"
                    class="relative grid gap-3 px-4 py-4 text-sm focus-within:z-[60] md:grid-cols-[minmax(220px,1fr)_minmax(260px,1.45fr)_minmax(220px,1.05fr)] md:items-start"
                  >
                    <div class="min-w-0">
                      <div class="flex min-w-0 items-center justify-between gap-3">
                        <p class="shrink-0 font-semibold text-ink">第 {{ episode.episode_number }} 集</p>
                        <p class="min-w-0 truncate text-right text-xs text-ink/55">{{ metaText(episode.date_air, episode.runtime) }}</p>
                      </div>
                      <p class="mt-1 line-clamp-2 text-xs text-ink/58">{{ episode.episode_title || '未命名' }}</p>
                    </div>
                    <div class="relative z-20 focus-within:z-[70]">
                      <span class="mb-1.5 block text-xs font-medium text-ink/55 md:hidden">外部关联</span>
                      <EpisodeExternalPicker
                        :model-value="episodeMatches[episode.episode_id] ?? null"
                        :external-episodes="spiderEpisodes"
                        :current-episode-id="episode.episode_id"
                        :assigned-episodes-by-value="assignedEpisodesByValue"
                        :missing-value="missingSelectedValue(episode)"
                        :disabled="saving || episodeMatchState(episode).hasMissingExternalValue"
                        @update:model-value="setEpisodeMatch(episode.episode_id, $event)"
                      />
                    </div>
                    <div class="md:pt-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" :class="changeClass(episodeChangeAction(episode))">
                          {{ changeLabel(episodeChangeAction(episode)) }}
                        </span>
                      </div>
                      <Tooltip as="div" :text="relationExplainText(episode)" placement="bottom" overflow-only class="mt-2 min-w-0">
                        <p class="truncate text-xs text-ink/50">{{ matchReason(episode) }}</p>
                      </Tooltip>
                      <Tooltip v-if="episodeRiskReasons(episode).length" as="div" :text="episodeRiskReasons(episode).join(' / ')" placement="bottom" overflow-only class="mt-2 min-w-0">
                        <p class="truncate text-xs font-medium text-rose-600 dark:text-rose-200">{{ compactRiskText(episode) }}</p>
                      </Tooltip>
                    </div>
                  </article>
                </div>
              </div>
            </section>
          </div>

          <footer class="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4">
            <button type="button" class="btn-ghost" :disabled="saving" @click="closeDialog">取消</button>
            <button v-if="mode === 'tv' && fetchingEpisodes" type="button" class="btn-secondary" @click="cancelFetch">取消请求</button>
            <button v-if="mode === 'tv'" type="button" class="btn-secondary" :disabled="loadingExisting || fetchingEpisodes || saving" @click="fetchExternalEpisodes">
              <Loader2 v-if="fetchingEpisodes" :size="17" class="animate-spin" />
              <RefreshCw v-else :size="17" />
              {{ spiderResult ? '重新获取' : '获取剧集' }}
            </button>
            <button v-if="mode === 'tv' && spiderResult" type="button" class="btn-primary" :disabled="saving || changedEpisodeCount === 0" @click="saveEpisodeMatches('all')">
              <Loader2 v-if="saving" :size="17" class="animate-spin" />
              <Save v-else :size="17" />
              保存关联
            </button>
            <button v-else-if="mode === 'movie'" type="button" class="btn-primary" :disabled="loadingExisting || saving" @click="saveMovie">
              <Loader2 v-if="saving" :size="17" class="animate-spin" />
              <Save v-else :size="17" />
              保存
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
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
