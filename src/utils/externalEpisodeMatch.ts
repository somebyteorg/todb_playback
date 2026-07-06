import type { EpisodeItem, ExternalSpiderEpisode } from '@/types/api'

export type EpisodeMatchSource = 'existing' | 'date' | 'number' | 'manual' | 'unmatched'
export type EpisodeMatchReason = EpisodeMatchSource | 'missing' | 'none'

export interface ExternalEpisodeMatchResult {
  matches: Record<number, string | null>
  sources: Record<number, EpisodeMatchSource>
}

export interface ExternalEpisodeMatchState {
  selectedValue: string | null
  selectedExternalEpisode: ExternalSpiderEpisode | null
  reason: EpisodeMatchReason
  hasMissingExternalValue: boolean
  hasDateMismatch: boolean
  hasNumberMismatch: boolean
  hasNumberDateMismatch: boolean
  hasDateNumberMismatch: boolean
  hasMatchMismatch: boolean
  needsManualReview: boolean
  needsReview: boolean
}

export function canAutoSaveExternalEpisodeMatch(state: ExternalEpisodeMatchState) {
  if (state.reason === 'number') return true
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
}): ExternalEpisodeMatchResult {
  const usedExternalValues = new Set<string>()
  const matches: Record<number, string | null> = {}
  const sources: Record<number, EpisodeMatchSource> = {}
  const localNumberCounts = countEpisodeNumbers(options.episodes)
  const externalNumberCounts = countEpisodeNumbers(options.externalEpisodes)
  const localDateCounts = countEpisodeDates(options.episodes)
  const externalDateCounts = countEpisodeDates(options.externalEpisodes)

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

  options.episodes.forEach((episode) => {
    if (matches[episode.episode_id]) return

    const matchedEpisode = findExternalEpisodeByUniqueNumber(episode, options.externalEpisodes, {
      localNumberCounts,
      externalNumberCounts,
      usedExternalValues,
    })
    if (!matchedEpisode) return

    matches[episode.episode_id] = matchedEpisode.external_value
    sources[episode.episode_id] = 'number'
    usedExternalValues.add(matchedEpisode.external_value)
  })

  options.episodes.forEach((episode) => {
    if (matches[episode.episode_id]) return

    const matchedEpisode = findExternalEpisodeByUniqueDate(episode, options.externalEpisodes, {
      localDateCounts,
      externalDateCounts,
      usedExternalValues,
    })
    if (!matchedEpisode) return

    matches[episode.episode_id] = matchedEpisode.external_value
    sources[episode.episode_id] = 'date'
    usedExternalValues.add(matchedEpisode.external_value)
  })

  return { matches, sources }
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
    hasDateNumberMismatch,
    hasMatchMismatch: hasDateMismatch || hasNumberMismatch,
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
  if (source === 'existing' || source === 'date' || source === 'number') return source
  return 'manual'
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
