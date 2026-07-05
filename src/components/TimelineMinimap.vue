<script setup lang="ts">
  import { computed, ref } from 'vue'
  import type { MarkerType } from '@/types/api'

  interface MinimapMarker {
    id: string
    type: MarkerType
    left: string
    width: string
  }

  const props = defineProps<{
    markers: MinimapMarker[]
    scrollLeft: number
    clientWidth: number
    scrollWidth: number
    markerColor: (type: MarkerType) => string
  }>()

  const emit = defineEmits<{
    scrollTo: [left: number]
  }>()

  const rootRef = ref<HTMLElement | null>(null)
  const drag = ref<{ pointerId: number; startX: number; startScrollLeft: number; viewportTravelWidth: number } | null>(null)

  const maxScrollLeft = computed(() => Math.max(0, props.scrollWidth - props.clientWidth))
  const viewportStyle = computed(() => {
    const total = Math.max(1, props.scrollWidth)
    const width = Math.min(100, Math.max(8, (props.clientWidth / total) * 100))
    const left = Math.min(100 - width, Math.max(0, (props.scrollLeft / total) * 100))

    return {
      left: `${left}%`,
      width: `${width}%`,
    }
  })

  function clampScroll(value: number) {
    return Math.min(maxScrollLeft.value, Math.max(0, value))
  }

  function renderedViewportWidth(trackWidth: number) {
    const total = Math.max(1, props.scrollWidth)
    const widthRatio = Math.min(1, Math.max(0.08, props.clientWidth / total))

    return trackWidth * widthRatio
  }

  function viewportTravelWidth(trackWidth: number) {
    return Math.max(1, trackWidth - renderedViewportWidth(trackWidth))
  }

  function trackRatio(event: PointerEvent) {
    const rect = rootRef.value?.getBoundingClientRect()
    if (!rect) return 0
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  }

  function scrollToRatio(ratio: number) {
    emit('scrollTo', clampScroll(props.scrollWidth * ratio - props.clientWidth / 2))
  }

  function startDrag(event: PointerEvent) {
    const root = rootRef.value
    if (!root) return

    event.preventDefault()
    root.setPointerCapture(event.pointerId)

    const onViewport = event.target instanceof HTMLElement && Boolean(event.target.closest('[data-minimap-viewport="true"]'))
    if (!onViewport) {
      scrollToRatio(trackRatio(event))
    }

    drag.value = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: onViewport ? props.scrollLeft : clampScroll(props.scrollWidth * trackRatio(event) - props.clientWidth / 2),
      viewportTravelWidth: viewportTravelWidth(Math.max(1, root.getBoundingClientRect().width)),
    }
  }

  function moveDrag(event: PointerEvent) {
    if (!drag.value || drag.value.pointerId !== event.pointerId) return
    const deltaRatio = (event.clientX - drag.value.startX) / drag.value.viewportTravelWidth
    const nextLeft = clampScroll(drag.value.startScrollLeft + deltaRatio * maxScrollLeft.value)
    emit('scrollTo', nextLeft)
  }

  function stopDrag(event: PointerEvent) {
    if (!drag.value || drag.value.pointerId !== event.pointerId) return
    const root = rootRef.value
    if (root?.hasPointerCapture(event.pointerId)) {
      root.releasePointerCapture(event.pointerId)
    }
    drag.value = null
  }
</script>

<template>
  <div
    ref="rootRef"
    class="relative h-12 touch-none overflow-hidden rounded-2xl border border-line bg-muted px-2 py-2"
    @pointerdown="startDrag"
    @pointermove="moveDrag"
    @pointerup="stopDrag"
    @pointercancel="stopDrag"
  >
    <div class="absolute inset-x-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-ink/10" />
    <span
      v-for="marker in markers"
      :key="marker.id"
      class="absolute top-1/2 h-3 -translate-y-1/2 rounded-full opacity-75"
      :class="markerColor(marker.type)"
      :style="{ left: marker.left, width: marker.width }"
    />
    <span data-minimap-viewport="true" class="absolute inset-y-1 cursor-grab rounded-xl border border-primary/45 bg-primary/10 shadow-sm active:cursor-grabbing" :style="viewportStyle" />
  </div>
</template>
