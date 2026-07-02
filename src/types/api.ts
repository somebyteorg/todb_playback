export type VideoType = 'movie' | 'tv'

export type MarkerType = 'intro' | 'credits' | 'recap' | 'advertisement' | 'chapter' | 'post_credits' | 'intermission' | 'preview'

export interface Paginated<T> {
  page: number
  page_size: number
  total: number
  items: T[]
}

export interface PlaybackVideoListItem {
  video_id: number
  video_type: VideoType
  video_title: string
  origin_title: string | null
  tagline: string | null
  runtime: number | null
  date_air: string | null
  is_adult: boolean
  image_backdrop: string | null
}

export interface VideoDetail {
  video_id: number
  video_type: VideoType
  video_title: string
  video_description: string | null
  tagline: string | null
  runtime: number | null
  status: string
  origin_title: string | null
  origin_countrys: string[]
  original_languages: string[]
  vote_average: number | null
  vote_count: number | null
  date_air: string | null
  is_adult: boolean
  image_poster: string | null
  image_backdrop: string | null
  image_logo: string | null
  titles_count: number
  parts_count: number
  genre_ids: number[]
  external_ids: Array<{ type: string; value: string }>
  is_can_edit: boolean
}

export interface SeasonItem {
  season_id: number
  season_number: number
  season_title: string
  season_description: string | null
  origin_title: string | null
  date_air: string | null
  vote_average: number | null
  vote_count: number | null
  image_poster: string | null
  episode_count: number
  is_can_edit?: boolean
}

export interface EpisodeItem {
  episode_id: number
  episode_number: number
  episode_title: string
  episode_description: string | null
  origin_title: string | null
  runtime: number | null
  date_air: string | null
  vote_average: number | null
  vote_count: number | null
  image_poster: string | null
  parts_count: number
  is_can_edit?: boolean
}

export interface EpisodeDetail extends EpisodeItem {
  video_id: number
  season_id: number
  is_can_edit: boolean
}

export interface PlaybackVersion {
  version_id: number
  video_list_id: number
  video_season_id: number | null
  video_episode_id: number | null
  name: string
  description: string | null
  runtime: number | null
}

export interface PlaybackMarker {
  marker_id: number
  marker_type: MarkerType
  language: string | null
  title: string | null
  time_start: number
  time_end: number | null
  source: string
  is_self: boolean
  user_avatar: string | null
  user_nickname: string | null
}

export interface PlaybackSprite {
  sprite_id: number
  sprite_name: string
  interval: number
  width: number
  height: number
  columns: number
  rows: number
  count_frame: number
  is_can_delete: boolean
  is_self: boolean
  user_avatar: string | null
  user_nickname: string | null
  created_at: string
}

export interface PlaybackAssetUploadResult {
  asset_id: number
  url: string
}

export interface PlaybackKey {
  key_id: number
  key_remark: string | null
  count_use: number
  created_at: string
  updated_at: string
}

export interface PlaybackVideoFilters {
  video_type?: VideoType | ''
  title?: string
  year?: string
  has_version?: '' | '0' | '1'
  page?: number
  page_size?: number
}

export interface VersionQuery {
  video_list_id: number
  video_season_id?: number | null
  video_episode_id?: number | null
  playback_version_id?: number | null
  page?: number
  page_size?: number
}

export interface MarkerUpdateItem {
  type: MarkerType
  language: string | null
  title: string | null
  time_start: number
  time_end: number | null
}

export interface SpriteCreatePayload {
  interval: number
  width: number
  height: number
  columns: number
  rows: number
  count_frame: number
  assets_ids: number[]
  name: string
}

export interface SpriteWithImages extends PlaybackSprite {
  images: string[]
}
