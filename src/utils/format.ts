import dayjs from 'dayjs'
import type { MarkerType, VideoType } from '@/types/api'

export function formatDateTime(value: string | null | undefined) {
  if (!value) return ''
  return dayjs(value).format('YYYY-MM-DD HH:mm')
}

export function formatDate(value: string | null | undefined) {
  if (!value) return ''
  return dayjs(value).format('YYYY-MM-DD')
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return ''
  const rounded = Math.max(0, Math.round(seconds))
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const rest = rounded % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  }

  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function formatClockTime(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return ''
  const rounded = Math.max(0, Math.round(seconds))
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const rest = rounded % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function imageUrl(imagePath: string | null | undefined, size = 'w1080') {
  if (!imagePath) return ''
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath
  return `https://image.theotherdb.org/${size}/${cleanPath}`
}

export function videoTypeLabel(type: VideoType | string | null | undefined) {
  if (type === 'movie') return '电影'
  if (type === 'tv') return '电视'
  return ''
}

export const markerTypeOptions: Array<{ value: MarkerType; label: string; mode: 'range' | 'point' }> = [
  { value: 'intro', label: '片头', mode: 'range' },
  { value: 'credits', label: '片尾', mode: 'range' },
  { value: 'recap', label: '回顾', mode: 'range' },
  { value: 'advertisement', label: '广告', mode: 'range' },
  { value: 'chapter', label: '章节', mode: 'point' },
  { value: 'post_credits', label: '彩蛋', mode: 'range' },
  { value: 'intermission', label: '休息', mode: 'range' },
  { value: 'preview', label: '预告', mode: 'range' },
]

export function markerTypeLabel(type: MarkerType | string) {
  return markerTypeOptions.find((item) => item.value === type)?.label ?? type
}

export function isRangeMarker(type: MarkerType | string) {
  return markerTypeOptions.find((item) => item.value === type)?.mode !== 'point'
}
