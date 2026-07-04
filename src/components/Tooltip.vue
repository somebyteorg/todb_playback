<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

  const props = withDefaults(
    defineProps<{
      text: string
      as?: 'span' | 'div'
      placement?: 'top' | 'bottom' | 'left' | 'right'
      offset?: number
      overflowOnly?: boolean
    }>(),
    {
      as: 'span',
      placement: 'top',
      offset: 10,
      overflowOnly: false,
    },
  )

  const open = ref(false)
  const anchor = ref<HTMLElement | null>(null)
  const bubble = ref<HTMLElement | null>(null)
  const coords = ref({ left: 0, top: 0 })
  const listenersAttached = ref(false)
  const hideTimer = ref<number | null>(null)

  const transformClass = computed(() => {
    switch (props.placement) {
      case 'bottom':
        return 'translate-x-[-50%]'
      case 'left':
        return 'translate-x-[-100%] -translate-y-1/2'
      case 'right':
        return 'translate-y-[-50%]'
      default:
        return 'translate-x-[-50%] -translate-y-full'
    }
  })

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
  }

  function updatePosition() {
    if (!anchor.value || !bubble.value) return

    const anchorRect = anchor.value.getBoundingClientRect()
    const bubbleRect = bubble.value.getBoundingClientRect()
    const spacing = props.offset

    switch (props.placement) {
      case 'bottom':
        coords.value = {
          left: anchorRect.left + anchorRect.width / 2,
          top: anchorRect.bottom + spacing,
        }
        coords.value.left = clamp(coords.value.left, bubbleRect.width / 2 + 8, window.innerWidth - bubbleRect.width / 2 - 8)
        coords.value.top = clamp(coords.value.top, 8, window.innerHeight - bubbleRect.height - 8)
        break
      case 'left':
        coords.value = {
          left: anchorRect.left - spacing,
          top: anchorRect.top + anchorRect.height / 2,
        }
        coords.value.left = clamp(coords.value.left, bubbleRect.width + 8, window.innerWidth - 8)
        coords.value.top = clamp(coords.value.top, bubbleRect.height / 2 + 8, window.innerHeight - bubbleRect.height / 2 - 8)
        break
      case 'right':
        coords.value = {
          left: anchorRect.right + spacing,
          top: anchorRect.top + anchorRect.height / 2,
        }
        coords.value.left = clamp(coords.value.left, 8, window.innerWidth - bubbleRect.width - 8)
        coords.value.top = clamp(coords.value.top, bubbleRect.height / 2 + 8, window.innerHeight - bubbleRect.height / 2 - 8)
        break
      default:
        coords.value = {
          left: anchorRect.left + anchorRect.width / 2,
          top: anchorRect.top - spacing,
        }
        coords.value.left = clamp(coords.value.left, bubbleRect.width / 2 + 8, window.innerWidth - bubbleRect.width / 2 - 8)
        coords.value.top = clamp(coords.value.top, bubbleRect.height + 8, window.innerHeight - 8)
        break
    }
  }

  function attachListeners() {
    if (listenersAttached.value) return
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    listenersAttached.value = true
  }

  function detachListeners() {
    if (!listenersAttached.value) return
    window.removeEventListener('scroll', updatePosition, true)
    window.removeEventListener('resize', updatePosition)
    listenersAttached.value = false
  }

  function hasOverflow(element: HTMLElement): boolean {
    if (element.scrollWidth - element.clientWidth > 1 || element.scrollHeight - element.clientHeight > 1) {
      return true
    }

    return Array.from(element.children).some((child) => child instanceof HTMLElement && hasOverflow(child))
  }

  function canShowTooltip() {
    if (!props.overflowOnly) return true
    if (!anchor.value) return false

    return hasOverflow(anchor.value)
  }

  function show() {
    if (!canShowTooltip()) {
      open.value = false
      return
    }

    if (hideTimer.value !== null) {
      window.clearTimeout(hideTimer.value)
      hideTimer.value = null
    }
    open.value = true
  }

  function hide() {
    if (hideTimer.value !== null) window.clearTimeout(hideTimer.value)
    hideTimer.value = window.setTimeout(() => {
      open.value = false
      hideTimer.value = null
    }, 100)
  }

  watch(open, async (value) => {
    if (!value) {
      detachListeners()
      return
    }

    attachListeners()
    await nextTick()
    updatePosition()
  })

  onBeforeUnmount(() => {
    if (hideTimer.value !== null) window.clearTimeout(hideTimer.value)
    detachListeners()
  })
</script>

<template>
  <component :is="props.as" ref="anchor" class="inline-flex" @pointerenter="show" @pointerleave="hide" @focusin="show" @focusout="hide">
    <slot />

    <Teleport to="body">
      <Transition name="tooltip">
        <div
          v-if="open"
          ref="bubble"
          class="fixed z-50 max-w-[min(22rem,calc(100vw-1rem))] rounded-2xl border border-line bg-panel px-3 py-2 text-xs font-medium leading-5 text-ink shadow-soft backdrop-blur"
          :class="transformClass"
          :style="{ left: `${coords.left}px`, top: `${coords.top}px` }"
          role="tooltip"
          @pointerenter="show"
          @pointerleave="hide"
        >
          {{ text }}
        </div>
      </Transition>
    </Teleport>
  </component>
</template>

<style scoped>
  .tooltip-enter-active,
  .tooltip-leave-active {
    transition:
      opacity 120ms ease,
      transform 120ms ease;
  }

  .tooltip-enter-from,
  .tooltip-leave-to {
    opacity: 0;
  }
</style>
