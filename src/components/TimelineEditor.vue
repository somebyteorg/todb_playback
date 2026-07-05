<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { Loader2, Pin, X } from '@lucide/vue'
  import TimelineHeaderBar from '@/components/TimelineHeaderBar.vue'
  import TimelineGridLines from '@/components/TimelineGridLines.vue'
  import TimelineMarkerEditorPanel from '@/components/TimelineMarkerEditorPanel.vue'
  import type { TimelineMarkerListItem } from '@/components/TimelineMarkerList.vue'
  import TimelineMarkerList from '@/components/TimelineMarkerList.vue'
  import TimelineMarkerPill from '@/components/TimelineMarkerPill.vue'
  import TimelineMinimap from '@/components/TimelineMinimap.vue'
  import TimelineSplitRail from '@/components/TimelineSplitRail.vue'
  import TimelineThumbnailPreview from '@/components/TimelineThumbnailPreview.vue'
  import type { TimelineTrashItem } from '@/components/TimelineTrashDialog.vue'
  import TimelineTrashDialog from '@/components/TimelineTrashDialog.vue'
  import TimelineViewControls from '@/components/TimelineViewControls.vue'
  import { useConfirmStore } from '@/stores/confirm'
  import { useToastStore } from '@/stores/toast'
  import { formatClockTime, formatDuration, isRangeMarker, markerTypeLabel, markerTypeOptions } from '@/utils/format'
  import { listMarkers, listSpriteImages, updateMarkers } from '@/utils/playback'
  import type { MarkerType, MarkerUpdateItem, PlaybackMarker, SpriteWithImages, VideoType } from '@/types/api'
  import type { ShortcutMode, TimelineLayoutMode, TimelineMarker, TimelineMutationStatus, TimelinePinnedThumbnail, TimelineThumbnailPreviewData } from '@/types/timeline'

  interface DragState {
    marker: TimelineMarker
    mode: 'move' | 'start' | 'end'
    anchorTime: number
    startTime: number
    endTime: number
  }

  interface EditorPanelDragState {
    anchorX: number
    anchorY: number
    left: number
    top: number
  }

  const TIMELINE_BASE_WIDTH = 760
  const SNAP_THRESHOLD_SECONDS = 3
  const THUMBNAIL_PREVIEW_HEIGHT = 240
  const THUMBNAIL_PREVIEW_SECTION_HEIGHT = THUMBNAIL_PREVIEW_HEIGHT + 48
  const HOVER_PIN_BUTTON_WIDTH = 76
  const HOVER_PIN_BUTTON_MIN_VISIBLE = 24
  const PINNED_THUMBNAIL_CLUSTER_GAP = 96
  const PINNED_THUMBNAIL_FAN_STEP = 80
  const PINNED_THUMBNAIL_MAX_NUDGE = 120
  const ZOOM_OPTIONS = [1, 2, 3, 4, 5, 6]
  const TIMELINE_MIN_GRID_WIDTH_PX = 18
  const TIMELINE_GRID_LABEL_MIN_GAP_PX = 96
  const TIMELINE_GRID_RENDER_BUFFER_PX = 360
  const TIMELINE_GRID_STEP_BY_ZOOM: Record<number, number> = {
    1: 30 * 60,
    2: 10 * 60,
    3: 5 * 60,
    4: 60,
    5: 30,
    6: 10,
  }
  const TIMELINE_GRID_LINE_STEP_BY_ZOOM: Record<number, number> = {
    ...TIMELINE_GRID_STEP_BY_ZOOM,
    6: 30,
  }

  const props = defineProps<{
    versionId: number
    duration: number | null
    canEdit: boolean
    sprites: SpriteWithImages[]
    videoType: VideoType
  }>()

  const emit = defineEmits<{
    saved: []
  }>()

  const confirm = useConfirmStore()
  const toast = useToastStore()
  const trackRef = ref<HTMLElement | null>(null)
  const timelineScrollerRef = ref<HTMLElement | null>(null)
  const timelineContentRef = ref<HTMLElement | null>(null)
  const editorPanelRef = ref<HTMLElement | null>(null)
  const markers = ref<TimelineMarker[]>([])
  const trashedMarkers = ref<TimelineMarker[]>([])
  const deletedIds = ref<number[]>([])
  const originalMarkerSnapshots = ref<Record<number, string>>({})
  const initialSnapshot = ref('')
  const activeMarker = ref<TimelineMarker | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const resetting = ref(false)
  const showTrash = ref(false)
  const typeFilters = ref<MarkerType[]>([])
  const selfFilter = ref(false)
  const thumbnailPreviewEnabled = ref(false)
  const selectedSpriteId = ref<number | null>(null)
  const spriteImagesById = ref<Record<number, string[]>>({})
  const spriteImageLoadingIds = ref<Set<number>>(new Set())
  const pinnedThumbnails = ref<TimelinePinnedThumbnail[]>([])
  const selectedPinnedThumbnailId = ref<string | null>(null)
  const nextPinnedThumbnailOrder = ref(1)
  const layoutMode = ref<TimelineLayoutMode>('split')
  const zoom = ref(3)
  const drag = ref<DragState | null>(null)
  const editorPanelDrag = ref<EditorPanelDragState | null>(null)
  const editorPanelPosition = ref<{ left: number; top: number } | null>(null)
  const hover = ref({ show: false, x: 0, clientX: 0, trackLeft: 0, trackRight: 0, trackTop: 0, time: 0 })
  const activeEndDraft = ref<number | null>(null)
  const selectedMarkerIds = ref<string[]>([])
  const scrollState = ref({ left: 0, width: 1, scrollWidth: 1 })

  const safeDuration = computed(() => Math.max(60, props.duration ?? 7200))
  const visibleMarkers = computed(() =>
    markers.value.filter((marker) => {
      if (typeFilters.value.length > 0 && !typeFilters.value.includes(marker.marker_type)) return false
      if (selfFilter.value && !marker.is_self) return false
      return true
    }),
  )
  const sortedMarkers = computed(() => [...visibleMarkers.value].sort((first, second) => first.time_start - second.time_start))
  const sortedTrashedMarkers = computed(() => [...trashedMarkers.value].sort((first, second) => first.time_start - second.time_start))
  const availableMarkerTypeOptions = computed(() => markerTypeOptions.filter((option) => option.value !== 'preview' || props.videoType === 'tv'))
  const timelineMarkerTypeOptions = computed(() => {
    const options = [...availableMarkerTypeOptions.value]
    markers.value.forEach((marker) => {
      if (!options.some((option) => option.value === marker.marker_type)) {
        const option = markerTypeOptions.find((item) => item.value === marker.marker_type)
        if (option) options.push(option)
      }
    })

    return options
  })
  const visibleMarkerTypes = computed(() => timelineMarkerTypeOptions.value.map((option) => option.value).filter((type) => visibleMarkers.value.some((marker) => marker.marker_type === type)))
  const splitRows = computed(() => (visibleMarkerTypes.value.length > 0 ? visibleMarkerTypes.value : availableMarkerTypeOptions.value.map((option) => option.value)))
  const trackHeight = computed(() => (layoutMode.value === 'split' ? `${Math.max(176, 72 + splitRows.value.length * 52)}px` : '176px'))
  const timelineWidth = computed(() => `${timelinePixelWidth()}px`)
  const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)
  const hasChanges = computed(() => markerSnapshot() !== initialSnapshot.value)
  const minimapMarkers = computed(() =>
    sortedMarkers.value.map((marker) => {
      const interval = markerInterval(marker)
      const left = (interval.start / safeDuration.value) * 100
      const width = isRangeMarker(marker.marker_type) ? Math.max(0.35, ((interval.end - interval.start) / safeDuration.value) * 100) : 0.6

      return {
        marker,
        left: `${left}%`,
        width: `${width}%`,
      }
    }),
  )
  const timelineGridWidthStepSeconds = computed(() => {
    return TIMELINE_GRID_STEP_BY_ZOOM[zoom.value] ?? TIMELINE_GRID_STEP_BY_ZOOM[6]
  })
  const timelineGridStepSeconds = computed(() => {
    return TIMELINE_GRID_LINE_STEP_BY_ZOOM[zoom.value] ?? timelineGridWidthStepSeconds.value
  })
  const timelineGridLabelStepSeconds = computed(() => {
    const pixelsPerGrid = (timelinePixelWidth() * timelineGridStepSeconds.value) / safeDuration.value
    const labelEveryGrid = Math.max(1, Math.ceil(TIMELINE_GRID_LABEL_MIN_GAP_PX / Math.max(1, pixelsPerGrid)))

    return timelineGridStepSeconds.value * labelEveryGrid
  })
  const visibleTimelineRange = computed(() => {
    const trackWidth = timelinePixelWidth()
    const startPixel = Math.max(0, scrollState.value.left - TIMELINE_GRID_RENDER_BUFFER_PX)
    const endPixel = Math.min(trackWidth, scrollState.value.left + scrollState.value.width + TIMELINE_GRID_RENDER_BUFFER_PX)

    if (scrollState.value.width <= 1 || scrollState.value.scrollWidth <= scrollState.value.width + 1) {
      return { start: 0, end: safeDuration.value }
    }

    return {
      start: (startPixel / trackWidth) * safeDuration.value,
      end: (endPixel / trackWidth) * safeDuration.value,
    }
  })
  const ticks = computed(() => {
    const step = timelineGridStepSeconds.value
    const labelStep = timelineGridLabelStepSeconds.value
    const range = visibleTimelineRange.value
    const start = Math.max(0, Math.floor(range.start / step) * step)
    const end = Math.min(safeDuration.value, Math.ceil(range.end / step) * step)
    const times = new Set<number>()

    for (let time = start; time <= end; time += step) {
      times.add(clampTime(time))
    }
    if (range.start <= step) times.add(0)
    if (safeDuration.value - range.end <= step) times.add(safeDuration.value)

    return Array.from(times)
      .sort((first, second) => first - second)
      .map((time) => ({
        time,
        left: `${(time / safeDuration.value) * 100}%`,
        showLabel: time === 0 || time === safeDuration.value || time % labelStep === 0,
      }))
  })
  const markerSelectOptions = computed(() =>
    availableMarkerTypeOptions.value.map((item) => ({
      value: item.value,
      label: item.label,
    })),
  )
  const markerCountSource = computed(() => (selfFilter.value ? markers.value.filter((marker) => marker.is_self) : markers.value))
  const markerCounts = computed(() => {
    const counts = Object.fromEntries(timelineMarkerTypeOptions.value.map((item) => [item.value, 0])) as Record<MarkerType, number>
    markerCountSource.value.forEach((marker) => {
      counts[marker.marker_type] += 1
    })

    return counts
  })
  const selfMarkerCount = computed(() => markers.value.filter((marker) => marker.is_self).length)
  const editorPanelStyle = computed(() =>
    editorPanelPosition.value
      ? {
          left: `${editorPanelPosition.value.left}px`,
          top: `${editorPanelPosition.value.top}px`,
        }
      : undefined,
  )
  const splitLabelRailStyle = computed(() => ({
    height: trackHeight.value,
    marginTop: thumbnailPreviewEnabled.value ? `${THUMBNAIL_PREVIEW_SECTION_HEIGHT}px` : '0px',
  }))
  const activeEndValue = computed(() => activeEndDraft.value ?? activeMarker.value?.time_end ?? null)
  const activeStartClock = computed(() => formatClockTime(activeMarker.value?.time_start))
  const activeEndClock = computed(() => formatClockTime(activeEndValue.value))
  const activeStartShortcutModes = computed<ShortcutMode[]>(() => (activeMarker.value?.marker_type === 'credits' ? ['remaining', 'absolute'] : ['absolute']))
  const activeEndShortcutModes = computed<ShortcutMode[]>(() => (isRangeMarker(activeMarker.value?.marker_type ?? '') ? ['duration', 'absolute'] : ['absolute']))
  const activeConflictMarkers = computed(() => (activeMarker.value ? findConflictingMarkers(activeMarker.value) : []))
  const activeConflictText = computed(() => {
    if (!activeMarker.value || activeConflictMarkers.value.length === 0) return ''
    const names = activeConflictMarkers.value
      .slice(0, 2)
      .map((marker) => marker.title || markerTypeLabel(marker.marker_type))
      .join('、')
    const suffix = activeConflictMarkers.value.length > 2 ? `等 ${activeConflictMarkers.value.length} 个` : ''

    return `与同类型 ${names}${suffix} 时间重叠`
  })
  const selectedMarkerSet = computed(() => new Set(selectedMarkerIds.value))
  const selectedMarkers = computed(() => markers.value.filter((marker) => selectedMarkerSet.value.has(marker.localId)))
  const canBulkDelete = computed(() => props.canEdit && selectedMarkers.value.length > 0)
  const canBulkRestore = computed(() => props.canEdit && trashedMarkers.value.length > 0)
  const previewSprites = computed(() =>
    props.sprites.map((sprite) => ({
      ...sprite,
      images: spriteImagesById.value[sprite.sprite_id] ?? sprite.images,
    })),
  )
  const hasPreviewSprites = computed(() => props.sprites.length > 0)
  const spriteSelectOptions = computed(() =>
    previewSprites.value.map((sprite) => ({
      value: sprite.sprite_id,
      label: spriteLabel(sprite),
    })),
  )
  const selectedSprite = computed(() => previewSprites.value.find((sprite) => sprite.sprite_id === selectedSpriteId.value) ?? null)

  function spriteLabel(sprite: SpriteWithImages) {
    return `${sprite.sprite_id}#${sprite.sprite_name}`
  }

  function spriteFrameForTime(sprite: SpriteWithImages, time: number) {
    const frameCount = Math.max(1, sprite.count_frame)
    return Math.min(frameCount - 1, Math.max(0, Math.floor(clampTime(time) / Math.max(1, sprite.interval))))
  }

  function thumbnailForSpriteTime(sprite: SpriteWithImages, time: number): TimelineThumbnailPreviewData | null {
    if (sprite.images.length === 0) return null

    const frame = spriteFrameForTime(sprite, time)
    const framesPerSheet = Math.max(1, sprite.columns * sprite.rows)
    const sheetIndex = Math.floor(frame / framesPerSheet)
    const image = sprite.images[sheetIndex]
    if (!image) return null

    const frameInSheet = frame % framesPerSheet
    const column = frameInSheet % sprite.columns
    const row = Math.floor(frameInSheet / sprite.columns)
    const frameWidth = Math.max(1, sprite.width)
    const frameHeight = Math.max(1, sprite.height)
    const scale = THUMBNAIL_PREVIEW_HEIGHT / frameHeight
    const previewWidth = Math.round(frameWidth * scale)

    return {
      spriteId: sprite.sprite_id,
      spriteName: sprite.sprite_name,
      frame,
      image,
      width: `${previewWidth}px`,
      height: `${THUMBNAIL_PREVIEW_HEIGHT}px`,
      backgroundSize: `${sprite.columns * previewWidth}px ${sprite.rows * THUMBNAIL_PREVIEW_HEIGHT}px`,
      backgroundPosition: `-${column * previewWidth}px -${row * THUMBNAIL_PREVIEW_HEIGHT}px`,
    }
  }

  const hoverThumbnail = computed(() => {
    if (!thumbnailPreviewEnabled.value || !selectedSprite.value) return null
    return thumbnailForSpriteTime(selectedSprite.value, hover.value.time)
  })
  const hoverPinnedThumbnail = computed(() => {
    if (!hover.value.show || !selectedSprite.value || !hoverThumbnail.value) return null
    return findPinnedThumbnailForPreview(hoverThumbnail.value, hover.value.time)
  })
  const hoverPinnedAtCurrentTime = computed(() => hoverPinnedThumbnail.value !== null)
  const pinnedThumbnailViews = computed(() =>
    pinnedThumbnails.value.map((pin, index) => ({
      ...pin,
      style: thumbnailPlacementStyle(pin.time, pin.thumbnail, 20 + index, pinnedThumbnailNudges.value[pin.localId] ?? 0),
      guideStyle: {
        left: `${(pin.time / safeDuration.value) * 100}%`,
        zIndex: 10 + index,
      },
    })),
  )
  const pinnedThumbnailControls = computed(() => [...pinnedThumbnailViews.value].sort((first, second) => first.pinOrder - second.pinOrder))
  const pinnedThumbnailNudges = computed(() => {
    const sortedPins = pinnedThumbnails.value
      .map((pin) => {
        const width = previewWidth(pin.thumbnail)
        const timelineLeft = (pin.time / safeDuration.value) * timelinePixelWidth()

        return {
          localId: pin.localId,
          baseLeft: clampThumbnailLeft(timelineLeft, width),
        }
      })
      .sort((first, second) => first.baseLeft - second.baseLeft)
    const nudges: Record<string, number> = {}
    let cluster: typeof sortedPins = []

    function flushCluster() {
      if (cluster.length === 0) return
      if (cluster.length === 1) {
        nudges[cluster[0].localId] = 0
        cluster = []
        return
      }

      const spread = Math.min(PINNED_THUMBNAIL_MAX_NUDGE, ((cluster.length - 1) * PINNED_THUMBNAIL_FAN_STEP) / 2)
      cluster.forEach((pin, index) => {
        nudges[pin.localId] = -spread + (spread * 2 * index) / Math.max(1, cluster.length - 1)
      })
      cluster = []
    }

    sortedPins.forEach((pin) => {
      const previous = cluster.at(-1)
      if (previous && pin.baseLeft - previous.baseLeft > PINNED_THUMBNAIL_CLUSTER_GAP) {
        flushCluster()
      }
      cluster.push(pin)
    })
    flushCluster()

    return nudges
  })
  const hoverThumbnailStyle = computed(() => (hoverThumbnail.value ? thumbnailHoverPlacementStyle(hoverThumbnail.value) : undefined))
  const hoverPinButtonStyle = computed(() => ({
    position: 'fixed',
    left: `${clampHoverPinClientX(hover.value.clientX)}px`,
    top: `${hover.value.trackTop + 12}px`,
    transform: 'translateX(-50%)',
    zIndex: 35,
  }))

  function previewWidth(thumbnail: TimelineThumbnailPreviewData) {
    return Number.parseInt(thumbnail.width, 10) || 0
  }

  function timelinePixelWidth() {
    const baseWidth = TIMELINE_BASE_WIDTH * zoom.value
    const gridCount = Math.ceil(safeDuration.value / timelineGridWidthStepSeconds.value)
    const gridWidth = gridCount * TIMELINE_MIN_GRID_WIDTH_PX

    return Math.round(Math.max(baseWidth, gridWidth))
  }

  function clampThumbnailLeft(left: number, width: number) {
    return clampFloatingLeft(left, width + 24)
  }

  function clampFloatingLeft(left: number, width: number) {
    const trackWidth = timelinePixelWidth()
    return Math.min(Math.max(width / 2 + 12, left), Math.max(width / 2 + 12, trackWidth - width / 2 - 12))
  }

  function clampHoverPinClientX(clientX: number) {
    const minCenter = hover.value.trackLeft + HOVER_PIN_BUTTON_MIN_VISIBLE - HOVER_PIN_BUTTON_WIDTH / 2
    const maxCenter = hover.value.trackRight - HOVER_PIN_BUTTON_MIN_VISIBLE + HOVER_PIN_BUTTON_WIDTH / 2

    return Math.min(Math.max(clientX, minCenter), Math.max(minCenter, maxCenter))
  }

  function thumbnailPlacementStyle(time: number, thumbnail: TimelineThumbnailPreviewData, zIndex: number, nudge = 0) {
    const width = previewWidth(thumbnail)
    const trackWidth = timelinePixelWidth()
    const timelineLeft = (time / safeDuration.value) * trackWidth
    const baseLeft = clampThumbnailLeft(timelineLeft, width)

    return {
      left: `${clampThumbnailLeft(baseLeft + nudge, width)}px`,
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex,
    }
  }

  function thumbnailHoverPlacementStyle(thumbnail: TimelineThumbnailPreviewData) {
    return {
      left: `${clampThumbnailLeft(hover.value.x, previewWidth(thumbnail))}px`,
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 30,
    }
  }

  function localId() {
    return `marker_${Date.now()}_${Math.random().toString(16).slice(2)}`
  }

  function normalizeMarker(marker: PlaybackMarker): TimelineMarker {
    return {
      localId: localId(),
      marker_id: marker.marker_id,
      marker_type: marker.marker_type,
      language: marker.language ?? null,
      title: marker.title,
      time_start: Math.max(0, Math.round(marker.time_start || 0)),
      time_end: marker.time_end === null ? null : Math.max(0, Math.round(marker.time_end)),
      source: marker.source,
      is_self: marker.is_self,
      user_avatar: marker.user_avatar,
      user_nickname: marker.user_nickname,
    }
  }

  function markerColor(type: MarkerType) {
    const colors: Record<MarkerType, string> = {
      intro: 'bg-emerald-500',
      credits: 'bg-rose-500',
      recap: 'bg-amber-500',
      advertisement: 'bg-fuchsia-500',
      chapter: 'bg-sky-500',
      post_credits: 'bg-violet-500',
      intermission: 'bg-orange-500',
      preview: 'bg-cyan-500',
    }

    return colors[type]
  }

  function sourceLabel(source: string) {
    const labels: Record<string, string> = {
      local: '暂存',
      user: '其他用户提交',
      official: '官方来源',
    }

    return labels[source] ?? source
  }

  function markerStyle(marker: TimelineMarker) {
    const start = (marker.time_start / safeDuration.value) * 100
    const rowIndex = layoutMode.value === 'split' ? Math.max(0, splitRows.value.indexOf(marker.marker_type)) : 0
    const top = layoutMode.value === 'split' ? 58 + rowIndex * 52 : 96

    if (!isRangeMarker(marker.marker_type)) {
      return {
        left: `${start}%`,
        top: `${top}px`,
        width: '12px',
        transform: 'translateX(-6px)',
      }
    }

    const end = marker.time_end ?? Math.min(safeDuration.value, marker.time_start + 60)
    const width = Math.max(0.35, ((end - marker.time_start) / safeDuration.value) * 100)

    return {
      left: `${start}%`,
      top: `${top}px`,
      width: `${width}%`,
    }
  }

  function rowStyle(index: number) {
    return {
      top: `${58 + index * 52}px`,
    }
  }

  function clampTime(value: number) {
    return Math.min(safeDuration.value, Math.max(0, Math.round(value)))
  }

  function markerSnapshot() {
    const markerItems = markers.value
      .map((marker) => ({
        id: marker.marker_id,
        localId: marker.marker_id ? null : marker.localId,
        type: marker.marker_type,
        language: marker.language ?? null,
        title: marker.title || null,
        time_start: clampTime(marker.time_start),
        time_end: isRangeMarker(marker.marker_type) ? Math.max(marker.time_start + 1, marker.time_end ?? marker.time_start + 1) : null,
      }))
      .sort((first, second) => String(first.id ?? first.localId).localeCompare(String(second.id ?? second.localId)))
    const deleteIds = Array.from(new Set(deletedIds.value)).sort((first, second) => first - second)

    return JSON.stringify({ markers: markerItems, deleteIds })
  }

  function markerItemSnapshot(item: MarkerUpdateItem) {
    return JSON.stringify({
      type: item.type,
      language: item.language,
      title: item.title,
      time_start: item.time_start,
      time_end: item.time_end,
    })
  }

  function markerPayloadSnapshot(marker: TimelineMarker) {
    return markerItemSnapshot(toUpdateItem(marker))
  }

  function markerMutationStatus(marker: TimelineMarker): TimelineMutationStatus {
    if (!marker.marker_id) return '新增'
    return originalMarkerSnapshots.value[marker.marker_id] !== markerPayloadSnapshot(marker) ? '已修改' : ''
  }

  function markerStatusClass(marker: TimelineMarker) {
    const status = markerMutationStatus(marker)
    if (status === '新增') return 'bg-primary text-white'
    if (status === '已修改') return 'bg-amber-500 text-white'
    return 'bg-ink/10 text-ink/55'
  }

  function markerListStatus(marker: TimelineMarkerListItem) {
    return markerMutationStatus(marker as TimelineMarker)
  }

  function markerListStatusClass(marker: TimelineMarkerListItem) {
    return markerStatusClass(marker as TimelineMarker)
  }

  function isListMarkerSelected(marker: TimelineMarkerListItem) {
    return isMarkerSelected(marker as TimelineMarker)
  }

  function listAvatarLabel(marker: TimelineMarkerListItem) {
    return avatarLabel(marker as TimelineMarker)
  }

  function selectListMarker(marker: TimelineMarkerListItem) {
    selectMarker(marker as TimelineMarker)
  }

  function toggleListMarkerSelection(marker: TimelineMarkerListItem) {
    toggleMarkerSelection(marker as TimelineMarker)
  }

  async function removeListMarker(marker: TimelineMarkerListItem) {
    await removeMarker(marker as TimelineMarker)
  }

  function trashAvatarLabel(marker: TimelineTrashItem) {
    return avatarLabel(marker as TimelineMarker)
  }

  function restoreTrashMarker(marker: TimelineTrashItem) {
    restoreMarker(marker as TimelineMarker)
  }

  function updateScrollState() {
    const scroller = timelineScrollerRef.value
    if (!scroller) return
    scrollState.value = {
      left: scroller.scrollLeft,
      width: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
    }
  }

  function setZoom(value: number) {
    zoom.value = Math.min(6, Math.max(1, Math.round(value)))
  }

  function onTimelineWheel(event: WheelEvent) {
    const scroller = timelineScrollerRef.value
    const content = timelineContentRef.value
    if (!scroller || !content) return

    event.preventDefault()

    const nextZoom = zoom.value + (event.deltaY < 0 ? 1 : -1)
    const previousZoom = zoom.value
    setZoom(nextZoom)
    if (zoom.value === previousZoom) return

    const scrollerRect = scroller.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    const pointerInScroller = event.clientX - scrollerRect.left
    const pointerInContent = Math.min(contentRect.width, Math.max(0, event.clientX - contentRect.left))
    const anchorRatio = contentRect.width > 0 ? pointerInContent / contentRect.width : 0
    const contentInset = contentRect.left - scrollerRect.left + scroller.scrollLeft

    void nextTick(() => {
      const nextContent = timelineContentRef.value
      const nextScroller = timelineScrollerRef.value
      if (!nextContent || !nextScroller) return

      const nextWidth = nextContent.getBoundingClientRect().width
      const nextScrollLeft = anchorRatio * nextWidth + contentInset - pointerInScroller
      const maxScrollLeft = Math.max(0, nextScroller.scrollWidth - nextScroller.clientWidth)
      nextScroller.scrollLeft = Math.min(maxScrollLeft, Math.max(0, nextScrollLeft))
      updateScrollState()
    })
  }

  function isTypeFilterSelected(type: MarkerType) {
    return typeFilters.value.includes(type)
  }

  function clearTypeFilters() {
    typeFilters.value = []
  }

  function resetTimelineFilters() {
    clearTypeFilters()
    selfFilter.value = false
  }

  function toggleSelfFilter() {
    selfFilter.value = !selfFilter.value
  }

  function toggleTypeFilter(type: MarkerType) {
    typeFilters.value = isTypeFilterSelected(type) ? typeFilters.value.filter((item) => item !== type) : [...typeFilters.value, type]
  }

  function ensureTypeFilterVisible(type: MarkerType) {
    if (typeFilters.value.length === 0 || typeFilters.value.includes(type)) return
    typeFilters.value = [...typeFilters.value, type]
  }

  function avatarLabel(marker: TimelineMarker) {
    return (marker.user_nickname || '用户').slice(0, 1).toUpperCase()
  }

  function timeFromClientX(clientX: number) {
    const rect = trackRef.value?.getBoundingClientRect()
    if (!rect) return 0

    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return clampTime(ratio * safeDuration.value)
  }

  function scrollTimelineToLeft(value: number) {
    const scroller = timelineScrollerRef.value
    if (!scroller) return
    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
    scroller.scrollLeft = Math.min(maxScrollLeft, Math.max(0, value))
    updateScrollState()
  }

  function setSelectedSprite(value: string | number | null) {
    if (value === null || value === '') {
      selectedSpriteId.value = null
      return
    }

    const spriteId = Number(value)
    selectedSpriteId.value = Number.isFinite(spriteId) ? spriteId : null
    void ensureSpriteImages(selectedSpriteId.value)
  }

  function hasCachedSpriteImages(spriteId: number) {
    return Object.prototype.hasOwnProperty.call(spriteImagesById.value, spriteId)
  }

  async function ensureSpriteImages(spriteId: number | null) {
    if (!spriteId || hasCachedSpriteImages(spriteId) || spriteImageLoadingIds.value.has(spriteId)) return

    const sprite = props.sprites.find((item) => item.sprite_id === spriteId)
    if (!sprite) return

    if (sprite.images.length > 0) {
      spriteImagesById.value = {
        ...spriteImagesById.value,
        [spriteId]: sprite.images,
      }
      return
    }

    const loadingIds = new Set(spriteImageLoadingIds.value)
    loadingIds.add(spriteId)
    spriteImageLoadingIds.value = loadingIds

    try {
      const images = await listSpriteImages(props.versionId, spriteId)
      spriteImagesById.value = {
        ...spriteImagesById.value,
        [spriteId]: images,
      }
    } catch {
      toast.push('预览图图片加载失败', 'error')
    } finally {
      const nextLoadingIds = new Set(spriteImageLoadingIds.value)
      nextLoadingIds.delete(spriteId)
      spriteImageLoadingIds.value = nextLoadingIds
    }
  }

  function enableThumbnailPreview() {
    thumbnailPreviewEnabled.value = true
    const spriteId = previewSprites.value[0]?.sprite_id ?? null
    selectedSpriteId.value = spriteId
    void ensureSpriteImages(spriteId)
  }

  function resetThumbnailPreviewState() {
    thumbnailPreviewEnabled.value = false
    selectedSpriteId.value = null
    spriteImagesById.value = {}
    spriteImageLoadingIds.value = new Set()
    pinnedThumbnails.value = []
    selectedPinnedThumbnailId.value = null
    nextPinnedThumbnailOrder.value = 1
    hover.value.show = false
  }

  function toggleThumbnailPreview() {
    if (thumbnailPreviewEnabled.value) {
      thumbnailPreviewEnabled.value = false
      hover.value.show = false
      return
    }

    enableThumbnailPreview()
  }

  function updateHover(event: PointerEvent) {
    if (!trackRef.value) return
    const rect = trackRef.value.getBoundingClientRect()
    hover.value = {
      show: true,
      x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
      clientX: event.clientX,
      trackLeft: rect.left,
      trackRight: rect.right,
      trackTop: rect.top,
      time: timeFromClientX(event.clientX),
    }
  }

  function hideHover() {
    hover.value.show = false
  }

  function findPinnedThumbnailForPreview(thumbnail: TimelineThumbnailPreviewData, time: number) {
    const sprite = previewSprites.value.find((item) => item.sprite_id === thumbnail.spriteId)
    const maxDistance = Math.max(1, sprite?.interval ?? 1)

    return (
      pinnedThumbnails.value
        .filter((item) => item.spriteId === thumbnail.spriteId && item.frame === thumbnail.frame && Math.abs(item.time - time) <= maxDistance)
        .sort((first, second) => Math.abs(first.time - time) - Math.abs(second.time - time))[0] ?? null
    )
  }

  function pinThumbnailAtTime(time: number) {
    if (!thumbnailPreviewEnabled.value || !selectedSprite.value) return
    const normalizedTime = clampTime(time)
    const thumbnail = thumbnailForSpriteTime(selectedSprite.value, normalizedTime)
    if (!thumbnail) return

    const existing = findPinnedThumbnailForPreview(thumbnail, normalizedTime)
    if (existing) {
      activatePinnedThumbnail(existing.localId)
      return
    }

    const localId = `thumb_${Date.now()}_${Math.random().toString(16).slice(2)}`
    pinnedThumbnails.value = [
      ...pinnedThumbnails.value,
      {
        localId,
        pinOrder: nextPinnedThumbnailOrder.value,
        time: normalizedTime,
        spriteId: thumbnail.spriteId,
        spriteName: thumbnail.spriteName,
        frame: thumbnail.frame,
        thumbnail,
      },
    ]
    selectedPinnedThumbnailId.value = localId
    nextPinnedThumbnailOrder.value += 1
  }

  function toggleHoverThumbnailPin() {
    if (!hover.value.show || !hoverThumbnail.value) return
    const existing = findPinnedThumbnailForPreview(hoverThumbnail.value, hover.value.time)
    if (existing) {
      unpinThumbnail(existing.localId)
      return
    }

    pinThumbnailAtTime(hover.value.time)
  }

  function unpinThumbnail(localId: string) {
    pinnedThumbnails.value = pinnedThumbnails.value.filter((item) => item.localId !== localId)
    if (selectedPinnedThumbnailId.value === localId) {
      selectedPinnedThumbnailId.value = null
    }
  }

  function activatePinnedThumbnail(localId: string) {
    const target = pinnedThumbnails.value.find((item) => item.localId === localId)
    if (!target) return
    selectedPinnedThumbnailId.value = localId
    pinnedThumbnails.value = [...pinnedThumbnails.value.filter((item) => item.localId !== localId), target]
  }

  function selectMarker(marker: TimelineMarker) {
    if (!props.canEdit) return

    activeMarker.value = marker
    activeEndDraft.value = marker.time_end
    void nextTick(ensureEditorPanelPosition)
  }

  function closeActiveMarker() {
    activeMarker.value = null
    activeEndDraft.value = null
  }

  function isMarkerSelected(marker: TimelineMarker) {
    return selectedMarkerSet.value.has(marker.localId)
  }

  function toggleMarkerSelection(marker: TimelineMarker) {
    selectedMarkerIds.value = isMarkerSelected(marker) ? selectedMarkerIds.value.filter((id) => id !== marker.localId) : [...selectedMarkerIds.value, marker.localId]
  }

  function clearSelection() {
    selectedMarkerIds.value = []
  }

  function startDrag(event: PointerEvent, marker: TimelineMarker, mode: DragState['mode']) {
    if (!props.canEdit) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    selectMarker(marker)

    drag.value = {
      marker,
      mode: isRangeMarker(marker.marker_type) ? mode : 'move',
      anchorTime: timeFromClientX(event.clientX),
      startTime: marker.time_start,
      endTime: marker.time_end ?? marker.time_start,
    }

    window.addEventListener('pointermove', onDrag)
    window.addEventListener('pointerup', stopDrag)
  }

  function onDrag(event: PointerEvent) {
    if (!drag.value) return

    const currentTime = timeFromClientX(event.clientX)
    const delta = currentTime - drag.value.anchorTime
    const target = drag.value.marker

    if (!isRangeMarker(target.marker_type)) {
      setMarkerStart(target, drag.value.startTime + delta, true)
      target.time_end = null
      return
    }

    if (drag.value.mode === 'start') {
      const maxStart = Math.max(0, (target.time_end ?? drag.value.endTime) - 1)
      setMarkerStart(target, Math.min(maxStart, drag.value.startTime + delta), true, true)
      return
    }

    if (drag.value.mode === 'end') {
      setMarkerEnd(target, drag.value.endTime + delta, true)
      return
    }

    const length = Math.max(1, drag.value.endTime - drag.value.startTime)
    const nextStart = Math.min(Math.max(0, drag.value.startTime + delta), safeDuration.value - length)
    target.time_start = drag.value.startTime
    target.time_end = drag.value.endTime
    moveMarker(target, nextStart, true)
  }

  function stopDrag() {
    drag.value = null
    window.removeEventListener('pointermove', onDrag)
    window.removeEventListener('pointerup', stopDrag)
  }

  function clampEditorPanelPosition(left: number, top: number) {
    const width = editorPanelRef.value?.offsetWidth ?? Math.min(380, window.innerWidth - 24)
    const height = editorPanelRef.value?.offsetHeight ?? 430
    const maxLeft = Math.max(12, window.innerWidth - width - 12)
    const maxTop = Math.max(12, window.innerHeight - height - 12)

    return {
      left: Math.min(maxLeft, Math.max(12, Math.round(left))),
      top: Math.min(maxTop, Math.max(12, Math.round(top))),
    }
  }

  function ensureEditorPanelPosition() {
    if (editorPanelPosition.value || !editorPanelRef.value) return
    const rect = editorPanelRef.value.getBoundingClientRect()
    editorPanelPosition.value = clampEditorPanelPosition(rect.left, rect.top)
  }

  function startEditorPanelDrag(event: PointerEvent) {
    if (!activeMarker.value) return
    event.preventDefault()
    ensureEditorPanelPosition()

    const position = editorPanelPosition.value ?? clampEditorPanelPosition(12, 96)
    editorPanelDrag.value = {
      anchorX: event.clientX,
      anchorY: event.clientY,
      left: position.left,
      top: position.top,
    }

    window.addEventListener('pointermove', onEditorPanelDrag)
    window.addEventListener('pointerup', stopEditorPanelDrag)
  }

  function onEditorPanelDrag(event: PointerEvent) {
    if (!editorPanelDrag.value) return
    editorPanelPosition.value = clampEditorPanelPosition(
      editorPanelDrag.value.left + event.clientX - editorPanelDrag.value.anchorX,
      editorPanelDrag.value.top + event.clientY - editorPanelDrag.value.anchorY,
    )
  }

  function stopEditorPanelDrag() {
    editorPanelDrag.value = null
    window.removeEventListener('pointermove', onEditorPanelDrag)
    window.removeEventListener('pointerup', stopEditorPanelDrag)
  }

  function defaultRangeForType(type: MarkerType) {
    if (type === 'intro') {
      return {
        start: 0,
        end: Math.min(safeDuration.value, 90),
      }
    }

    if (type === 'credits') {
      return {
        start: Math.max(0, safeDuration.value - 90),
        end: safeDuration.value,
      }
    }

    const start = clampTime(hover.value.time || 0)
    return {
      start,
      end: Math.min(safeDuration.value, start + 60),
    }
  }

  function isRequiredRangeType(type: MarkerType) {
    return type === 'intro' || type === 'credits'
  }

  function markerInterval(marker: TimelineMarker) {
    const start = marker.time_start
    const end = isRangeMarker(marker.marker_type) ? Math.max(start + 1, marker.time_end ?? start + 1) : start + 1

    return { start, end }
  }

  function requiredRangeError(marker: TimelineMarker) {
    if (!isRequiredRangeType(marker.marker_type)) return ''

    const label = markerTypeLabel(marker.marker_type)
    if (!Number.isFinite(marker.time_start)) return `${label}的开始时间为必填`
    if (typeof marker.time_end !== 'number' || !Number.isFinite(marker.time_end)) return `${label}的结束时间为必填`
    if (marker.time_end <= marker.time_start) return `${label}的结束时间必须大于开始时间`

    return ''
  }

  function validateRequiredRangeMarkers() {
    const invalidMarker = markers.value.find((marker) => requiredRangeError(marker))
    if (!invalidMarker) return true

    toast.push(requiredRangeError(invalidMarker), 'error')
    selectMarker(invalidMarker)
    return false
  }

  function intervalsOverlap(first: { start: number; end: number }, second: { start: number; end: number }) {
    return first.start < second.end && second.start < first.end
  }

  function markerIntervalFromValues(type: MarkerType, start: number, end: number | null) {
    const targetEnd = isRangeMarker(type) ? Math.max(start + 1, end ?? start + 1) : start + 1

    return { start, end: targetEnd }
  }

  function findConflictingMarkers(target: TimelineMarker) {
    const targetInterval = markerInterval(target)

    return markers.value.filter((marker) => {
      if (marker.localId === target.localId || marker.marker_type !== target.marker_type) return false
      return intervalsOverlap(targetInterval, markerInterval(marker))
    })
  }

  function overlapsExistingMarkers(type: MarkerType, start: number, end: number | null) {
    const targetInterval = markerIntervalFromValues(type, start, end)

    return markers.value.some((marker) => marker.marker_type === type && intervalsOverlap(targetInterval, markerInterval(marker)))
  }

  function snapTime(value: number, marker?: TimelineMarker) {
    const candidates = new Set<number>([0, Math.max(0, safeDuration.value - 90), safeDuration.value])
    markers.value.forEach((item) => {
      if (item.localId === marker?.localId) return
      candidates.add(item.time_start)
      if (item.time_end !== null) candidates.add(item.time_end)
    })

    let snapped = clampTime(value)
    let bestDistance = SNAP_THRESHOLD_SECONDS + 1
    candidates.forEach((candidate) => {
      const distance = Math.abs(value - candidate)
      if (distance <= SNAP_THRESHOLD_SECONDS && distance < bestDistance) {
        snapped = clampTime(candidate)
        bestDistance = distance
      }
    })

    return snapped
  }

  function setMarkerStart(marker: TimelineMarker, value: number, snap = false, keepEnd = false) {
    let nextStart = snap ? snapTime(value, marker) : clampTime(value)
    if (isRangeMarker(marker.marker_type)) {
      nextStart = Math.min(nextStart, Math.max(0, safeDuration.value - 1))
      if (keepEnd && marker.time_end !== null) {
        nextStart = Math.min(nextStart, Math.max(0, marker.time_end - 1))
      }
    }

    marker.time_start = nextStart
    if (isRangeMarker(marker.marker_type) && marker.time_end !== null) {
      marker.time_end = Math.min(safeDuration.value, Math.max(nextStart + 1, marker.time_end))
      activeEndDraft.value = marker.time_end
    }
  }

  function setMarkerEnd(marker: TimelineMarker, value: number, snap = false) {
    if (!isRangeMarker(marker.marker_type)) {
      marker.time_end = null
      return
    }

    if (marker.time_start >= safeDuration.value) {
      marker.time_start = Math.max(0, safeDuration.value - 1)
    }
    const nextEnd = snap ? snapTime(value, marker) : clampTime(value)
    marker.time_end = Math.min(safeDuration.value, Math.max(marker.time_start + 1, nextEnd))
    activeEndDraft.value = marker.time_end
  }

  function moveMarker(marker: TimelineMarker, nextStartValue: number, snap = false) {
    if (!isRangeMarker(marker.marker_type)) {
      setMarkerStart(marker, nextStartValue, snap)
      marker.time_end = null
      return
    }

    const length = Math.max(1, (marker.time_end ?? marker.time_start + 1) - marker.time_start)
    const maxStart = Math.max(0, safeDuration.value - length)
    const nextStart = snap ? snapTime(Math.min(maxStart, Math.max(0, nextStartValue)), marker) : clampTime(Math.min(maxStart, Math.max(0, nextStartValue)))
    marker.time_start = Math.min(maxStart, nextStart)
    marker.time_end = Math.min(safeDuration.value, marker.time_start + length)
    activeEndDraft.value = marker.time_end
  }

  function moveRangeAfterOverlaps(type: MarkerType, range: { start: number; end: number }) {
    const isRange = isRangeMarker(type)
    const length = isRange ? Math.max(1, range.end - range.start) : 1
    const maxStart = isRange ? Math.max(0, safeDuration.value - length) : safeDuration.value
    let start = Math.min(maxStart, clampTime(range.start))
    let end = isRange ? Math.min(safeDuration.value, start + length) : null
    let attempts = 0

    while (overlapsExistingMarkers(type, start, end) && attempts < 100) {
      const nextStart = Math.min(maxStart, start + 300)
      if (nextStart === start) break
      start = nextStart
      end = isRange ? Math.min(safeDuration.value, start + length) : null
      attempts += 1
    }

    return {
      start,
      end: end ?? range.end,
    }
  }

  function addMarker(type: MarkerType) {
    if (!props.canEdit) return

    const range = moveRangeAfterOverlaps(type, defaultRangeForType(type))
    const marker: TimelineMarker = {
      localId: localId(),
      marker_id: null,
      marker_type: type,
      language: null,
      title: null,
      time_start: range.start,
      time_end: isRangeMarker(type) ? Math.max(range.start + 1, range.end) : null,
      source: 'local',
      is_self: true,
      user_avatar: null,
      user_nickname: null,
    }

    markers.value.push(marker)
    ensureTypeFilterVisible(type)
    selectMarker(marker)
  }

  async function removeMarker(marker: TimelineMarker) {
    if (marker.marker_id) {
      const ok = await confirm.ask({
        title: '删除时间标记',
        message: '删除后需要保存才会提交到后台。',
        danger: true,
      })

      if (!ok) return
      deletedIds.value.push(marker.marker_id)
    }

    trashedMarkers.value = [marker, ...trashedMarkers.value.filter((item) => item.localId !== marker.localId)]
    markers.value = markers.value.filter((item) => item.localId !== marker.localId)
    selectedMarkerIds.value = selectedMarkerIds.value.filter((id) => id !== marker.localId)
    if (activeMarker.value?.localId === marker.localId) {
      activeMarker.value = null
      activeEndDraft.value = null
    }
  }

  async function removeActive() {
    if (!activeMarker.value) return
    await removeMarker(activeMarker.value)
  }

  function restoreMarker(marker: TimelineMarker) {
    trashedMarkers.value = trashedMarkers.value.filter((item) => item.localId !== marker.localId)
    markers.value.push(marker)

    if (marker.marker_id) {
      deletedIds.value = deletedIds.value.filter((item) => item !== marker.marker_id)
    }

    activeMarker.value = marker
    activeEndDraft.value = marker.time_end
    if (trashedMarkers.value.length === 0) {
      showTrash.value = false
    }
  }

  async function bulkRemoveSelected() {
    if (!canBulkDelete.value) return
    const savedMarkers = selectedMarkers.value.filter((marker) => marker.marker_id)
    if (savedMarkers.length > 0) {
      const ok = await confirm.ask({
        title: '批量删除时间标记',
        message: `将删除选中的 ${selectedMarkers.value.length} 个时间标记，已保存的标记需要保存时间轴后才会提交到后台。`,
        danger: true,
      })

      if (!ok) return
      savedMarkers.forEach((marker) => {
        if (marker.marker_id) deletedIds.value.push(marker.marker_id)
      })
    }

    const selectedIds = new Set(selectedMarkers.value.map((marker) => marker.localId))
    trashedMarkers.value = [...selectedMarkers.value, ...trashedMarkers.value.filter((marker) => !selectedIds.has(marker.localId))]
    markers.value = markers.value.filter((marker) => !selectedIds.has(marker.localId))
    if (activeMarker.value && selectedIds.has(activeMarker.value.localId)) {
      activeMarker.value = null
      activeEndDraft.value = null
    }
    clearSelection()
  }

  function restoreAllTrashed() {
    if (!canBulkRestore.value) return
    const restoreIds = new Set(trashedMarkers.value.map((marker) => marker.localId))
    markers.value = [...markers.value, ...trashedMarkers.value]
    trashedMarkers.value.forEach((marker) => {
      if (marker.marker_id) {
        deletedIds.value = deletedIds.value.filter((item) => item !== marker.marker_id)
      }
    })
    selectedMarkerIds.value = selectedMarkerIds.value.filter((id) => !restoreIds.has(id))
    trashedMarkers.value = []
    showTrash.value = false
  }

  function setActiveType(type: MarkerType) {
    if (!activeMarker.value) return
    activeMarker.value.marker_type = type
    ensureTypeFilterVisible(type)

    if (!isRangeMarker(type)) {
      activeMarker.value.time_end = null
      activeEndDraft.value = null
      return
    }

    if (type === 'intro') {
      const range = defaultRangeForType(type)
      activeMarker.value.time_start = range.start
      if (activeMarker.value.time_end === null || activeMarker.value.time_end <= activeMarker.value.time_start) {
        activeMarker.value.time_end = Math.max(activeMarker.value.time_start + 1, range.end)
      }
      activeEndDraft.value = activeMarker.value.time_end
      return
    }

    if (type === 'credits') {
      const range = defaultRangeForType(type)
      activeMarker.value.time_end = range.end
      if (activeMarker.value.time_start >= activeMarker.value.time_end) {
        activeMarker.value.time_start = range.start
      }
      activeEndDraft.value = activeMarker.value.time_end
      return
    }

    if (activeMarker.value.time_end === null) {
      activeMarker.value.time_end = Math.min(safeDuration.value, activeMarker.value.time_start + 60)
      activeEndDraft.value = activeMarker.value.time_end
    }
  }

  function setActiveStart(value: string | number | null) {
    if (!activeMarker.value) return
    setMarkerStart(activeMarker.value, Number(value ?? 0))
  }

  function setActiveEnd(value: string | number | null) {
    if (!activeMarker.value || !isRangeMarker(activeMarker.value.marker_type)) return
    if (value === null || value === '') {
      activeEndDraft.value = null
      return
    }

    const nextEnd = Number(value)
    if (!Number.isFinite(nextEnd)) return
    activeEndDraft.value = clampTime(nextEnd)
    if (activeEndDraft.value > activeMarker.value.time_start) {
      setMarkerEnd(activeMarker.value, activeEndDraft.value)
    }
  }

  function commitActiveEnd() {
    if (!activeMarker.value || !isRangeMarker(activeMarker.value.marker_type)) return
    const minEnd = activeMarker.value.time_start + 1
    setMarkerEnd(activeMarker.value, Math.max(minEnd, activeEndDraft.value ?? minEnd))
  }

  function setActiveTitle(value: string | number | null) {
    if (!activeMarker.value) return
    activeMarker.value.title = value ? String(value) : null
  }

  function nudgeActiveMarker(delta: number) {
    if (!props.canEdit || !activeMarker.value) return
    const marker = activeMarker.value
    if (isRangeMarker(marker.marker_type)) {
      moveMarker(marker, marker.time_start + delta)
      return
    }

    setMarkerStart(marker, marker.time_start + delta)
  }

  function isEditableElement(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  }

  function onKeydown(event: KeyboardEvent) {
    if (isEditableElement(event.target)) return

    if (event.key === 'Escape' && activeMarker.value) {
      closeActiveMarker()
      return
    }

    if (!props.canEdit || !activeMarker.value) return

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      void removeActive()
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const direction = event.key === 'ArrowRight' ? 1 : -1
      nudgeActiveMarker(direction * (event.shiftKey ? 10 : 1))
    }
  }

  function toUpdateItem(marker: TimelineMarker): MarkerUpdateItem {
    return {
      type: marker.marker_type,
      language: marker.language ?? null,
      title: marker.title || null,
      time_start: clampTime(marker.time_start),
      time_end: isRangeMarker(marker.marker_type) ? Math.max(marker.time_start + 1, marker.time_end ?? marker.time_start + 1) : null,
    }
  }

  function markerSavePayload() {
    const deleteIds = new Set(deletedIds.value)
    const items: MarkerUpdateItem[] = []

    markers.value.forEach((marker) => {
      if (!marker.marker_id) {
        items.push(toUpdateItem(marker))
        return
      }

      if (originalMarkerSnapshots.value[marker.marker_id] !== markerPayloadSnapshot(marker)) {
        deleteIds.add(marker.marker_id)
        items.push(toUpdateItem(marker))
      }
    })

    return {
      delete_marker_ids: Array.from(deleteIds),
      items,
    }
  }

  async function resetMarkers() {
    if (!props.canEdit || resetting.value) return
    const ok = await confirm.ask({
      title: '重置时间轴',
      message: '将放弃本地所有更改，并重新加载后台时间标记。',
      danger: true,
    })

    if (!ok) return
    resetting.value = true

    try {
      await loadMarkers()
      toast.push('时间轴已重置', 'success')
    } finally {
      resetting.value = false
    }
  }

  async function saveMarkers() {
    if (!props.canEdit || saving.value || !hasChanges.value) return
    if (!validateRequiredRangeMarkers()) return

    saving.value = true

    try {
      await updateMarkers(props.versionId, markerSavePayload())
      toast.push('时间轴已保存', 'success')
      await loadMarkers()
      emit('saved')
    } finally {
      saving.value = false
    }
  }

  async function loadMarkers() {
    loading.value = true

    try {
      const items = await listMarkers(props.versionId)
      const normalizedMarkers = items.map(normalizeMarker)
      markers.value = normalizedMarkers
      originalMarkerSnapshots.value = Object.fromEntries(normalizedMarkers.filter((marker) => marker.marker_id !== null).map((marker) => [marker.marker_id, markerPayloadSnapshot(marker)]))
      deletedIds.value = []
      trashedMarkers.value = []
      selectedMarkerIds.value = []
      showTrash.value = false
      activeMarker.value = null
      activeEndDraft.value = null
      initialSnapshot.value = markerSnapshot()
      await nextTick()
      updateScrollState()
    } finally {
      loading.value = false
    }
  }

  watch(
    () => props.versionId,
    () => {
      resetThumbnailPreviewState()
      void loadMarkers()
    },
  )
  watch(sortedMarkers, () => {
    const visibleIds = new Set(markers.value.map((marker) => marker.localId))
    selectedMarkerIds.value = selectedMarkerIds.value.filter((id) => visibleIds.has(id))
  })
  watch(timelineWidth, () => {
    void nextTick(updateScrollState)
  })
  watch(previewSprites, (sprites) => {
    if (!selectedSpriteId.value) return
    if (sprites.some((sprite) => sprite.sprite_id === selectedSpriteId.value)) return
    const spriteId = thumbnailPreviewEnabled.value ? (sprites[0]?.sprite_id ?? null) : null
    selectedSpriteId.value = spriteId
    void ensureSpriteImages(spriteId)
  })

  onMounted(() => {
    void loadMarkers()
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('resize', updateScrollState)
  })
  onBeforeUnmount(() => {
    stopDrag()
    stopEditorPanelDrag()
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('resize', updateScrollState)
  })
</script>

<template>
  <section class="space-y-5">
    <TimelineHeaderBar
      :can-edit="canEdit"
      :loading="loading"
      :saving="saving"
      :resetting="resetting"
      :has-changes="hasChanges"
      :selected-marker-count="selectedMarkers.length"
      :can-bulk-delete="canBulkDelete"
      :trashed-count="trashedMarkers.length"
      :thumbnail-preview-enabled="thumbnailPreviewEnabled"
      :has-preview-sprites="hasPreviewSprites"
      :selected-sprite-id="selectedSpriteId"
      :sprite-select-options="spriteSelectOptions"
      :marker-type-options="markerSelectOptions"
      @toggle-thumbnail-preview="toggleThumbnailPreview"
      @update-selected-sprite="setSelectedSprite"
      @bulk-remove-selected="bulkRemoveSelected"
      @open-trash="showTrash = true"
      @reset-markers="resetMarkers"
      @save-markers="saveMarkers"
      @add-marker="addMarker"
    />

    <div class="panel hidden overflow-visible md:block">
      <TimelineViewControls
        :layout-mode="layoutMode"
        :self-filter="selfFilter"
        :self-marker-count="selfMarkerCount"
        :type-filters="typeFilters"
        :marker-type-options="timelineMarkerTypeOptions"
        :marker-counts="markerCounts"
        :zoom="zoom"
        :zoom-options="ZOOM_OPTIONS"
        :zoom-percent="zoomPercent"
        :marker-color="markerColor"
        @update-layout-mode="layoutMode = $event"
        @clear-filters="resetTimelineFilters"
        @toggle-self-filter="toggleSelfFilter"
        @toggle-type-filter="toggleTypeFilter"
        @set-zoom="setZoom"
      />
      <div v-if="loading" class="grid min-h-56 place-items-center text-ink/55">
        <Loader2 :size="28" class="animate-spin" />
      </div>
      <div v-if="!loading" ref="timelineScrollerRef" class="overflow-x-auto p-4" @scroll="updateScrollState" @wheel="onTimelineWheel">
        <TimelineSplitRail v-if="layoutMode === 'split'" :rows="splitRows" :rail-style="splitLabelRailStyle" :row-style="rowStyle" :marker-color="markerColor" />
        <div ref="timelineContentRef" class="min-w-[760px]" :class="layoutMode === 'split' ? 'ml-[calc(4rem+0.5rem)]' : ''" :style="{ width: timelineWidth }">
          <TimelineThumbnailPreview
            v-if="thumbnailPreviewEnabled"
            :selected="Boolean(selectedSprite)"
            :selected-pin-id="selectedPinnedThumbnailId"
            :controls="pinnedThumbnailControls"
            :pins="pinnedThumbnailViews"
            :hover-show="hover.show"
            :hover-time="hover.time"
            :hover-thumbnail="hoverThumbnail"
            :hover-thumbnail-style="hoverThumbnailStyle"
            @activate-pin="activatePinnedThumbnail"
            @unpin="unpinThumbnail"
          />
          <div
            ref="trackRef"
            class="relative rounded-2xl border border-line bg-[linear-gradient(180deg,var(--timeline-top),var(--timeline-bottom))]"
            :style="{ height: trackHeight }"
            @pointermove="updateHover"
            @pointerleave="hideHover"
          >
            <template v-if="thumbnailPreviewEnabled">
              <div v-for="pin in pinnedThumbnailViews" :key="`${pin.localId}_guide`" class="pointer-events-none absolute top-0 h-full border-l border-primary/55" :style="pin.guideStyle" />
              <button
                v-if="hover.show && hoverThumbnail"
                type="button"
                class="absolute inline-flex h-8 items-center gap-1.5 rounded-full bg-panel/95 px-3 text-xs font-semibold text-ink/65 shadow-sm ring-1 ring-line transition hover:bg-primary/10 hover:text-primary-strong"
                :style="hoverPinButtonStyle"
                :aria-label="hoverPinnedAtCurrentTime ? '解锁当前位置预览图' : '锁定当前位置预览图'"
                @click.stop="toggleHoverThumbnailPin"
              >
                <Pin v-if="!hoverPinnedAtCurrentTime" :size="14" />
                <X v-else :size="14" />
                {{ hoverPinnedAtCurrentTime ? '解锁' : 'Pin' }}
              </button>
            </template>
            <TimelineGridLines :split="layoutMode === 'split'" :rows="splitRows" :ticks="ticks" :row-style="rowStyle" />
            <TimelineMarkerPill
              v-for="marker in sortedMarkers"
              :key="marker.localId"
              :marker="marker"
              :can-edit="canEdit"
              :active="activeMarker?.localId === marker.localId"
              :selected="isMarkerSelected(marker)"
              :conflicting="findConflictingMarkers(marker).length > 0"
              :changed="Boolean(markerMutationStatus(marker))"
              :marker-color="markerColor"
              :marker-style="markerStyle(marker)"
              @select="selectMarker"
              @start-drag="startDrag"
            />
          </div>

          <div class="mt-3 flex items-center justify-between text-xs text-ink/55">
            <span>00:00</span>
            <span>{{ formatDuration(safeDuration) }}</span>
          </div>
        </div>
      </div>
      <div v-if="!loading" class="border-t border-line px-4 py-3">
        <TimelineMinimap
          :markers="
            minimapMarkers.map((item) => ({
              id: item.marker.localId,
              type: item.marker.marker_type,
              left: item.left,
              width: item.width,
            }))
          "
          :scroll-left="scrollState.left"
          :client-width="scrollState.width"
          :scroll-width="scrollState.scrollWidth"
          :marker-color="markerColor"
          @scroll-to="scrollTimelineToLeft"
        />
      </div>
    </div>

    <div v-if="loading" class="grid min-h-32 place-items-center rounded-3xl border border-line bg-panel text-ink/55 md:hidden">
      <Loader2 :size="24" class="animate-spin" />
    </div>

    <TimelineMarkerList
      :markers="sortedMarkers"
      :can-edit="canEdit"
      :marker-color="markerColor"
      :marker-status="markerListStatus"
      :marker-status-class="markerListStatusClass"
      :is-selected="isListMarkerSelected"
      :source-label="sourceLabel"
      :avatar-label="listAvatarLabel"
      @select="selectListMarker"
      @toggle-selection="toggleListMarkerSelection"
      @remove="removeListMarker"
    />

    <Teleport to="body">
      <Transition name="slide">
        <section
          v-if="activeMarker"
          ref="editorPanelRef"
          class="fixed z-30 rounded-2xl border border-line bg-panel p-4 shadow-soft"
          :class="editorPanelPosition ? 'w-[calc(100vw-1.5rem)] max-w-[380px]' : 'inset-x-3 bottom-24 md:inset-x-auto md:bottom-5 md:right-5 md:w-[380px]'"
          :style="editorPanelStyle"
        >
          <TimelineMarkerEditorPanel
            :marker="activeMarker"
            :can-edit="canEdit"
            :duration="safeDuration"
            :marker-type-options="markerSelectOptions"
            :mutation-status="markerMutationStatus(activeMarker)"
            :mutation-status-class="markerStatusClass(activeMarker)"
            :conflict-text="activeConflictText"
            :start-clock="activeStartClock"
            :end-clock="activeEndClock"
            :end-value="activeEndValue"
            :start-shortcut-modes="activeStartShortcutModes"
            :end-shortcut-modes="activeEndShortcutModes"
            @start-drag="startEditorPanelDrag"
            @remove="removeActive"
            @close="closeActiveMarker"
            @update-type="setActiveType"
            @update-title="setActiveTitle"
            @update-start="setActiveStart"
            @update-end="setActiveEnd"
            @commit-end="commitActiveEnd"
          />
        </section>
      </Transition>
    </Teleport>

    <TimelineTrashDialog
      :open="showTrash"
      :markers="sortedTrashedMarkers"
      :can-bulk-restore="canBulkRestore"
      :marker-color="markerColor"
      :source-label="sourceLabel"
      :avatar-label="trashAvatarLabel"
      @close="showTrash = false"
      @restore="restoreTrashMarker"
      @restore-all="restoreAllTrashed"
    />
  </section>
</template>

<style scoped>
  .slide-enter-active,
  .slide-leave-active {
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }

  .slide-enter-from,
  .slide-leave-to {
    opacity: 0;
    transform: translateY(12px);
  }
</style>
