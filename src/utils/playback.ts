import { apiDeleteVoid, apiJson, apiPostJson, apiPostVoid, apiPutVoid, apiUpload, cleanSearchParams } from '@/utils/api'
import type {
  EpisodeDetail,
  EpisodeItem,
  MarkerType,
  MarkerUpdateItem,
  Paginated,
  PlaybackAssetUploadResult,
  PlaybackKey,
  PlaybackMarker,
  PlaybackSprite,
  PlaybackVersion,
  PlaybackVideoFilters,
  PlaybackVideoListItem,
  SeasonItem,
  SpriteCreatePayload,
  VersionQuery,
  VideoDetail,
} from '@/types/api'

export function listPlaybackVideos(filters: PlaybackVideoFilters) {
  return apiJson<Paginated<PlaybackVideoListItem>>(`api/playback/video`, {
    searchParams: cleanSearchParams({
      video_type: filters.video_type,
      title: filters.title,
      year: filters.year,
      has_version: filters.has_version,
      page: filters.page ?? 1,
      page_size: filters.page_size ?? 9,
    }),
  })
}

export function getVideoDetail(videoId: number) {
  return apiJson<VideoDetail>(`api/video/${videoId}`)
}

export function listSeasons(videoId: number) {
  return apiJson<SeasonItem[]>(`api/playback/video/${videoId}/seasonAll`)
}

export function listEpisodes(videoId: number, videoSeasonId: number) {
  return apiJson<EpisodeItem[]>(`api/playback/video/${videoId}/episodeAll`, {
    searchParams: cleanSearchParams({
      video_season_id: videoSeasonId,
    }),
  })
}

export function getEpisodeDetail(videoId: number, seasonNumber: number, episodeNumber: number) {
  return apiJson<EpisodeDetail>(`api/video/${videoId}/season/${seasonNumber}/episode/${episodeNumber}`, {}, [404])
}

export function listVersions(query: VersionQuery) {
  return apiJson<Paginated<PlaybackVersion>>(`api/playback/version`, {
    searchParams: cleanSearchParams({
      video_list_id: query.video_list_id,
      video_season_id: query.video_season_id,
      video_episode_id: query.video_episode_id,
      playback_version_id: query.playback_version_id,
      page: query.page ?? 1,
      page_size: query.page_size ?? 20,
    }),
  })
}

export function createPlaybackVersion(options: { video_list_id: number; video_episode_id: number | null; name: string; runtime?: number | null }) {
  return apiPostJson<{ version_id: number }>(`api/playback/version`, {
    video_list_id: options.video_list_id,
    video_episode_id: options.video_episode_id,
    name: options.name,
    runtime: options.runtime ?? null,
  })
}

export function createDefaultVersion(options: { video_list_id: number; video_episode_id: number | null; runtime?: number | null }) {
  return createPlaybackVersion({
    ...options,
    name: '默认',
  })
}

export function updateVersion(
  versionId: number,
  payload: {
    name: string
    description: string | null
    runtime: number | null
  },
) {
  return apiPutVoid(`api/playback/version/${versionId}`, payload)
}

export function deleteVersion(versionId: number) {
  return apiDeleteVoid(`api/playback/version/${versionId}`)
}

export function listMarkers(versionId: number, types?: MarkerType[]) {
  const searchParams = new URLSearchParams()

  types?.forEach((type) => searchParams.append('types[]', type))

  return apiJson<PlaybackMarker[]>(`api/playback/marker/${versionId}`, {
    searchParams,
  })
}

export function updateMarkers(
  versionId: number,
  payload: {
    delete_marker_ids: number[]
    items: MarkerUpdateItem[]
  },
) {
  return apiPostVoid(`api/playback/marker/${versionId}/update`, payload)
}

export function listSprites(versionId: number) {
  return apiJson<PlaybackSprite[]>(`api/playback/sprite/${versionId}`)
}

export function createSprite(versionId: number, payload: SpriteCreatePayload) {
  return apiPostJson<{ sprite_id: number }>(`api/playback/sprite/${versionId}`, payload)
}

export function deleteSprite(versionId: number, spriteId: number) {
  return apiDeleteVoid(`api/playback/sprite/${versionId}/${spriteId}`)
}

export function listSpriteImages(versionId: number, spriteId: number) {
  return apiJson<string[]>(`api/playback/sprite/${versionId}/${spriteId}/image`)
}

export function uploadPlaybackAsset(versionId: number, file: File, type = 'sprite') {
  const body = new FormData()

  body.append('playback_version_id', String(versionId))
  body.append('type', type)
  body.append('file', file)

  return apiUpload<PlaybackAssetUploadResult>(`api/playback/asset/upload`, body)
}

export function listPlaybackKeys() {
  return apiJson<PlaybackKey[]>(`api/playback/key`)
}

export function createPlaybackKey(remark: string | null) {
  return apiPostJson<{ key: string }>(`api/playback/key`, { remark })
}

export function deletePlaybackKey(keyId: number) {
  return apiDeleteVoid(`api/playback/key/${keyId}`)
}
