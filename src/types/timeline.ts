import type { MarkerType } from '@/types/api'

export interface SelectOption<T = string | number> {
  value: T
  label: string
}

export interface TimelineMarker {
  localId: string
  marker_id: number | null
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

export interface TimelineThumbnailPreviewData {
  spriteId: number
  spriteName: string
  frame: number
  image: string
  width: string
  height: string
  backgroundSize: string
  backgroundPosition: string
}

export interface TimelinePinnedThumbnail {
  localId: string
  pinOrder: number
  time: number
  spriteId: number
  spriteName: string
  frame: number
  thumbnail: TimelineThumbnailPreviewData
}

export type TimelineLayoutMode = 'merged' | 'split'
export type TimelineMutationStatus = '新增' | '已修改' | ''
export type ShortcutMode = 'absolute' | 'remaining' | 'duration'
