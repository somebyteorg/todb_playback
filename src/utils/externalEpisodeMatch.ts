import type { EpisodeItem, ExternalSpiderEpisode } from '@/types/api'

export type EpisodeMatchMode = 'auto' | 'number' | 'date' | 'offset'
export type EpisodeMatchSource = 'existing' | 'date' | 'number' | 'offset' | 'manual' | 'unmatched'
export type EpisodeMatchReason = EpisodeMatchSource | 'missing' | 'none'

export interface ExternalEpisodeMatchResult {
  matches: Record<number, string | null>
  sources: Record<number, EpisodeMatchSource>
  plan: ExternalEpisodeMatchPlan
}

export interface ExternalEpisodeMatchPlan {
  requestedMode: EpisodeMatchMode
  effectiveMode: Exclude<EpisodeMatchMode, 'auto'> | 'none'
  offset: number | null
  inferredOffset: number | null
  anchorCount: number
}

export interface ExternalEpisodeMatchState {
  selectedValue: string | null
  selectedExternalEpisode: ExternalSpiderEpisode | null
  reason: EpisodeMatchReason
  hasMissingExternalValue: boolean
  hasDateMismatch: boolean
  hasNumberMismatch: boolean
  hasNumberDateMismatch: boolean
  hasOffsetDateMismatch: boolean
  hasDateNumberMismatch: boolean
  hasMatchMismatch: boolean
  needsManualReview: boolean
  needsReview: boolean
}

export function canAutoSaveExternalEpisodeMatch(state: ExternalEpisodeMatchState) {
  if (state.reason === 'number' || state.reason === 'offset') return true
  return state.reason === 'date' && !state.needsReview
}

export function countEpisodeDates<T extends { date_air: string | null | undefined }>(items: T[]) {
  const counts: Record<string, number> = {}

  items.forEach((item) => {
    if (!item.date_air) return
    counts[item.date_air] = (counts[item.date_air] ?? 0) + 1
  })

  return counts
}

export function countEpisodeNumbers<T extends { episode_number: number }>(items: T[]) {
  const counts: Record<number, number> = {}

  items.forEach((item) => {
    counts[item.episode_number] = (counts[item.episode_number] ?? 0) + 1
  })

  return counts
}

export function episodeCanKeepExistingMatch(episode: EpisodeItem) {
  return episode.playback_versions_count > 0
}

export function buildExternalEpisodeMatches(options: {
  episodes: EpisodeItem[]
  externalEpisodes: ExternalSpiderEpisode[]
  existingValuesByEpisodeId: Partial<Record<number, string | null>>
  mode?: EpisodeMatchMode
  offset?: number | null
}): ExternalEpisodeMatchResult {
  const usedExternalValues = new Set<string>()
  const matches: Record<number, string | null> = {}
  const sources: Record<number, EpisodeMatchSource> = {}
  const requestedMode = options.mode ?? 'auto'
  const localNumberCounts = countEpisodeNumbers(options.episodes)
  const externalNumberCounts = countEpisodeNumbers(options.externalEpisodes)
  const localDateCounts = countEpisodeDates(options.episodes)
  const externalDateCounts = countEpisodeDates(options.externalEpisodes)
  const inferredOffset = inferEpisodeOffset({
    episodes: options.episodes,
    externalEpisodes: options.externalEpisodes,
    localDateCounts,
    externalDateCounts,
    externalNumberCounts,
  })

  options.episodes.forEach((episode) => {
    const existingValue = options.existingValuesByEpisodeId[episode.episode_id] ?? null
    matches[episode.episode_id] = null
    sources[episode.episode_id] = 'unmatched'

    if (existingValue && episodeCanKeepExistingMatch(episode)) {
      matches[episode.episode_id] = existingValue
      sources[episode.episode_id] = 'existing'
      usedExternalValues.add(existingValue)
    }
  })

  let effectiveMode: ExternalEpisodeMatchPlan['effectiveMode'] = 'none'
  let offset: number | null = null

  if (requestedMode === 'offset') {
    offset = normalizeOffset(options.offset)
    if (
      applyOffsetMatches(options.episodes, options.externalEpisodes, {
        localNumberCounts,
        externalNumberCounts,
        usedExternalValues,
        matches,
        sources,
        offset,
        source: offset === 0 ? 'number' : 'offset',
      }) > 0
    ) {
      effectiveMode = offset === 0 ? 'number' : 'offset'
    }
  } else if (requestedMode === 'number') {
    if (
      applyNumberMatches(options.episodes, options.externalEpisodes, {
        localNumberCounts,
        externalNumberCounts,
        usedExternalValues,
        matches,
        sources,
      }) > 0
    ) {
      effectiveMode = 'number'
    }
  } else if (requestedMode === 'date') {
    if (
      applyDateMatches(options.episodes, options.externalEpisodes, {
        localDateCounts,
        externalDateCounts,
        usedExternalValues,
        matches,
        sources,
      }) > 0
    ) {
      effectiveMode = 'date'
    }
  } else {
    offset = inferredOffset?.offset ?? null

    if (offset !== null) {
      const source = offset === 0 ? 'number' : 'offset'
      if (
        applyOffsetMatches(options.episodes, options.externalEpisodes, {
          localNumberCounts,
          externalNumberCounts,
          usedExternalValues,
          matches,
          sources,
          offset,
          source,
        }) > 0
      ) {
        effectiveMode = source === 'offset' ? 'offset' : 'number'
      }
    }

    if (
      applyDateMatches(options.episodes, options.externalEpisodes, {
        localDateCounts,
        externalDateCounts,
        usedExternalValues,
        matches,
        sources,
      }) > 0 &&
      effectiveMode === 'none'
    ) {
      effectiveMode = 'date'
    }

    if (offset === null && shouldUsePlainNumberFallback(options.episodes, options.externalEpisodes)) {
      if (
        applyNumberMatches(options.episodes, options.externalEpisodes, {
          localNumberCounts,
          externalNumberCounts,
          usedExternalValues,
          matches,
          sources,
        }) > 0 &&
        effectiveMode === 'none'
      ) {
        effectiveMode = 'number'
      }
    }
  }

  return {
    matches,
    sources,
    plan: {
      requestedMode,
      effectiveMode,
      offset,
      inferredOffset: inferredOffset?.offset ?? null,
      anchorCount: inferredOffset?.anchorCount ?? 0,
    },
  }
}

export function describeExternalEpisodeMatch(options: {
  episode: EpisodeItem
  selectedValue: string | null
  source: EpisodeMatchSource | undefined
  externalByValue: Map<string, ExternalSpiderEpisode>
}): ExternalEpisodeMatchState {
  const source = options.source ?? 'manual'
  const selectedValue = options.selectedValue || null
  const selectedExternalEpisode = selectedValue ? (options.externalByValue.get(selectedValue) ?? null) : null
  const reason = matchReasonForState(source, selectedValue, selectedExternalEpisode)
  const hasMissingExternalValue = Boolean(selectedValue && !selectedExternalEpisode)
  const hasDateMismatch = Boolean(options.episode.date_air && selectedExternalEpisode?.date_air && options.episode.date_air !== selectedExternalEpisode.date_air)
  const hasNumberMismatch = Boolean(selectedExternalEpisode && options.episode.episode_number !== selectedExternalEpisode.episode_number)
  const hasNumberDateMismatch = reason === 'number' && hasDateMismatch
  const hasOffsetDateMismatch = reason === 'offset' && hasDateMismatch
  const hasDateNumberMismatch = reason === 'date' && hasNumberMismatch
  const needsManualReview = hasDateNumberMismatch
  const needsReview = selectedValue ? hasMissingExternalValue || needsManualReview : source === 'unmatched'

  return {
    selectedValue,
    selectedExternalEpisode,
    reason,
    hasMissingExternalValue,
    hasDateMismatch,
    hasNumberMismatch,
    hasNumberDateMismatch,
    hasOffsetDateMismatch,
    hasDateNumberMismatch,
    hasMatchMismatch: hasNumberDateMismatch || hasOffsetDateMismatch || hasDateNumberMismatch,
    needsManualReview,
    needsReview,
  }
}

export function externalEpisodeMatchRiskReasons(options: {
  episode: EpisodeItem
  state: ExternalEpisodeMatchState
  localDateCounts: Record<string, number>
  externalDateCounts: Record<string, number>
  willDelete: boolean
}) {
  const reasons: string[] = []

  if (options.state.hasMissingExternalValue) {
    reasons.push('当前外部值不在平台返回列表中')
  }

  if (options.state.hasNumberDateMismatch) {
    reasons.push('按集数匹配但播出日期不一致')
  }

  if (options.state.hasOffsetDateMismatch) {
    reasons.push('按偏移集数匹配但播出日期不一致')
  }

  if (options.state.reason === 'date' && options.episode.date_air) {
    const localCount = options.localDateCounts[options.episode.date_air] ?? 0
    const externalCount = options.externalDateCounts[options.episode.date_air] ?? 0

    if (localCount > 1 || externalCount > 1) {
      reasons.push(`同日期存在多集（本地 ${localCount} / 外部 ${externalCount}）`)
    }
  }

  if (options.state.hasDateNumberMismatch) {
    reasons.push('按日期匹配但集数不同')
  }

  if (options.willDelete) {
    reasons.push('保存后会删除当前关联')
  }

  return reasons
}

function matchReasonForState(source: EpisodeMatchSource, selectedValue: string | null, selectedExternalEpisode: ExternalSpiderEpisode | null): EpisodeMatchReason {
  if (!selectedValue) return source === 'unmatched' ? 'unmatched' : 'none'
  if (!selectedExternalEpisode) return 'missing'
  if (source === 'existing' || source === 'date' || source === 'number' || source === 'offset') return source
  return 'manual'
}

function normalizeOffset(value: number | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

function inferEpisodeOffset(options: {
  episodes: EpisodeItem[]
  externalEpisodes: ExternalSpiderEpisode[]
  localDateCounts: Record<string, number>
  externalDateCounts: Record<string, number>
  externalNumberCounts: Record<number, number>
}) {
  const anchors = options.episodes
    .map((episode) => {
      if (!episode.date_air) return null
      if ((options.localDateCounts[episode.date_air] ?? 0) !== 1) return null
      if ((options.externalDateCounts[episode.date_air] ?? 0) !== 1) return null

      const externalEpisode = options.externalEpisodes.find((item) => item.date_air === episode.date_air)
      if (!externalEpisode) return null

      return {
        offset: externalEpisode.episode_number - episode.episode_number,
        externalNumber: externalEpisode.episode_number,
      }
    })
    .filter((item): item is { offset: number; externalNumber: number } => item !== null)

  if (anchors.length < 2) return null

  const offsetCounts: Record<number, number> = {}
  anchors.forEach((anchor) => {
    offsetCounts[anchor.offset] = (offsetCounts[anchor.offset] ?? 0) + 1
  })

  const ranked = Object.entries(offsetCounts)
    .map(([offset, count]) => ({ offset: Number(offset), count }))
    .sort((a, b) => b.count - a.count)
  const best = ranked[0]
  const second = ranked[1]

  if (!best || best.count < 2) return null
  if (second && best.count === second.count) return null
  if (best.count < Math.ceil(anchors.length / 2)) return null

  const mappedCount = options.episodes.filter((episode) => (options.externalNumberCounts[episode.episode_number + best.offset] ?? 0) === 1).length
  if (mappedCount < best.count) return null

  return {
    offset: best.offset,
    anchorCount: best.count,
  }
}

function shouldUsePlainNumberFallback(episodes: EpisodeItem[], externalEpisodes: ExternalSpiderEpisode[]) {
  const localMax = Math.max(0, ...episodes.map((episode) => episode.episode_number))
  const externalMax = Math.max(0, ...externalEpisodes.map((episode) => episode.episode_number))

  return externalMax <= localMax + 2 && externalEpisodes.length <= episodes.length + 2
}

function applyNumberMatches(
  episodes: EpisodeItem[],
  externalEpisodes: ExternalSpiderEpisode[],
  options: {
    localNumberCounts: Record<number, number>
    externalNumberCounts: Record<number, number>
    usedExternalValues: Set<string>
    matches: Record<number, string | null>
    sources: Record<number, EpisodeMatchSource>
  },
) {
  let count = 0

  episodes.forEach((episode) => {
    if (options.matches[episode.episode_id]) return

    const matchedEpisode = findExternalEpisodeByUniqueNumber(episode, externalEpisodes, options)
    if (!matchedEpisode) return

    options.matches[episode.episode_id] = matchedEpisode.external_value
    options.sources[episode.episode_id] = 'number'
    options.usedExternalValues.add(matchedEpisode.external_value)
    count += 1
  })

  return count
}

function applyOffsetMatches(
  episodes: EpisodeItem[],
  externalEpisodes: ExternalSpiderEpisode[],
  options: {
    localNumberCounts: Record<number, number>
    externalNumberCounts: Record<number, number>
    usedExternalValues: Set<string>
    matches: Record<number, string | null>
    sources: Record<number, EpisodeMatchSource>
    offset: number
    source: Extract<EpisodeMatchSource, 'number' | 'offset'>
  },
) {
  let count = 0

  episodes.forEach((episode) => {
    if (options.matches[episode.episode_id]) return
    if ((options.localNumberCounts[episode.episode_number] ?? 0) !== 1) return

    const targetNumber = episode.episode_number + options.offset
    if ((options.externalNumberCounts[targetNumber] ?? 0) !== 1) return

    const matchedEpisode = externalEpisodes.find((externalEpisode) => !options.usedExternalValues.has(externalEpisode.external_value) && externalEpisode.episode_number === targetNumber)
    if (!matchedEpisode) return

    options.matches[episode.episode_id] = matchedEpisode.external_value
    options.sources[episode.episode_id] = options.source
    options.usedExternalValues.add(matchedEpisode.external_value)
    count += 1
  })

  return count
}

function applyDateMatches(
  episodes: EpisodeItem[],
  externalEpisodes: ExternalSpiderEpisode[],
  options: {
    localDateCounts: Record<string, number>
    externalDateCounts: Record<string, number>
    usedExternalValues: Set<string>
    matches: Record<number, string | null>
    sources: Record<number, EpisodeMatchSource>
  },
) {
  let count = 0

  episodes.forEach((episode) => {
    if (options.matches[episode.episode_id]) return

    const matchedEpisode = findExternalEpisodeByUniqueDate(episode, externalEpisodes, options)
    if (!matchedEpisode) return

    options.matches[episode.episode_id] = matchedEpisode.external_value
    options.sources[episode.episode_id] = 'date'
    options.usedExternalValues.add(matchedEpisode.external_value)
    count += 1
  })

  return count
}

function findExternalEpisodeByUniqueNumber(
  episode: EpisodeItem,
  externalEpisodes: ExternalSpiderEpisode[],
  options: {
    localNumberCounts: Record<number, number>
    externalNumberCounts: Record<number, number>
    usedExternalValues: Set<string>
  },
) {
  if ((options.localNumberCounts[episode.episode_number] ?? 0) !== 1) return null
  if ((options.externalNumberCounts[episode.episode_number] ?? 0) !== 1) return null

  return externalEpisodes.find((externalEpisode) => !options.usedExternalValues.has(externalEpisode.external_value) && externalEpisode.episode_number === episode.episode_number) ?? null
}

function findExternalEpisodeByUniqueDate(
  episode: EpisodeItem,
  externalEpisodes: ExternalSpiderEpisode[],
  options: {
    localDateCounts: Record<string, number>
    externalDateCounts: Record<string, number>
    usedExternalValues: Set<string>
  },
) {
  if (!episode.date_air) return null
  if ((options.localDateCounts[episode.date_air] ?? 0) !== 1) return null
  if ((options.externalDateCounts[episode.date_air] ?? 0) !== 1) return null

  return externalEpisodes.find((externalEpisode) => !options.usedExternalValues.has(externalEpisode.external_value) && externalEpisode.date_air === episode.date_air) ?? null
}
