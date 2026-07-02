<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { Clock3, X } from '@lucide/vue'
  import ClearableInput from '@/components/ClearableInput.vue'
  import { formatDuration } from '@/utils/format'
  import type { ShortcutMode } from '@/types/timeline'

  const props = withDefaults(
    defineProps<{
      modelValue: number | null | undefined
      title?: string
      buttonLabel?: string
      inputLabel?: string
      modes?: ShortcutMode[]
      duration?: number | null
      anchor?: number | null
      min?: number
      max?: number
      disabled?: boolean
    }>(),
    {
      title: '快捷输入时长',
      buttonLabel: '快捷输入',
      inputLabel: '时长',
      modes: () => ['absolute'],
      duration: null,
      anchor: null,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    },
  )

  const emit = defineEmits<{
    'update:modelValue': [value: number]
  }>()

  const open = ref(false)
  const draft = ref('')
  const mode = ref<ShortcutMode>('absolute')

  const parsedSeconds = computed(() => parseTimeInput(draft.value))
  const modeOptions: Array<{ value: ShortcutMode; label: string }> = [
    { value: 'absolute', label: '时间点' },
    { value: 'remaining', label: '距结尾' },
    { value: 'duration', label: '持续时长' },
  ]
  const availableModes = computed(() => modeOptions.filter((item) => props.modes.includes(item.value)))
  const canUseRemainingMode = computed(() => props.duration !== null && props.duration !== undefined && Number.isFinite(props.duration))
  const canUseDurationMode = computed(() => props.anchor !== null && props.anchor !== undefined && Number.isFinite(props.anchor))
  const resolvedSeconds = computed(() => {
    if (parsedSeconds.value === null || !Number.isFinite(parsedSeconds.value)) return null
    if (mode.value === 'remaining') {
      if (!canUseRemainingMode.value) return null
      return clampSeconds(Number(props.duration) - parsedSeconds.value)
    }
    if (mode.value === 'duration') {
      if (!canUseDurationMode.value) return null
      return clampSeconds(Number(props.anchor) + parsedSeconds.value)
    }

    return clampSeconds(parsedSeconds.value)
  })
  const helperText = computed(() => {
    if (resolvedSeconds.value !== null) return formatDuration(resolvedSeconds.value)
    if (availableModes.value.some((item) => item.value === 'duration')) {
      return '支持 1:30:00、90:00、5400、90分钟；持续时长会基于开始时间自动换算。'
    }
    if (availableModes.value.some((item) => item.value === 'remaining')) {
      return '支持 1:30:00、90:00、5400、90分钟；距结尾模式可输入最后 1:30。'
    }

    return '支持 1:30:00、90:00、5400、90分钟、1小时30分。'
  })

  function clampSeconds(value: number) {
    return Math.min(props.max, Math.max(props.min, Math.round(value)))
  }

  function draftForMode(targetMode: ShortcutMode, absoluteSeconds: number | null | undefined) {
    if (absoluteSeconds === null || absoluteSeconds === undefined || !Number.isFinite(absoluteSeconds)) return ''
    if (targetMode === 'remaining' && canUseRemainingMode.value) {
      return String(Math.max(0, Math.round(Number(props.duration) - absoluteSeconds)))
    }
    if (targetMode === 'duration' && canUseDurationMode.value) {
      return String(Math.max(0, Math.round(absoluteSeconds - Number(props.anchor))))
    }

    return String(Math.round(absoluteSeconds))
  }

  function parseTimeInput(value: string) {
    const input = value.trim().replace(/：/g, ':')
    if (!input) return null

    if (/^\d+(\.\d+)?$/.test(input)) {
      return Number(input)
    }

    if (/^\d+(:\d{1,2}){1,2}$/.test(input)) {
      const parts = input.split(':').map(Number)
      if (parts.some((part) => !Number.isFinite(part))) return null

      if (parts.length === 2) {
        const [minutes, seconds] = parts
        return minutes * 60 + seconds
      }

      const [hours, minutes, seconds] = parts
      return hours * 3600 + minutes * 60 + seconds
    }

    const hourMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:小时|时|h)/i)
    const minuteMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:分钟|分|m)/i)
    const secondMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:秒|s)/i)

    if (!hourMatch && !minuteMatch && !secondMatch) return null

    return Number(hourMatch?.[1] ?? 0) * 3600 + Number(minuteMatch?.[1] ?? 0) * 60 + Number(secondMatch?.[1] ?? 0)
  }

  function showDialog() {
    if (props.disabled) return
    mode.value = props.modes[0] ?? 'absolute'
    draft.value = draftForMode(mode.value, props.modelValue)
    open.value = true
  }

  function closeDialog() {
    open.value = false
  }

  function setDraft(value: string | number | null) {
    draft.value = value ? String(value) : ''
    if (resolvedSeconds.value === null) return
    emit('update:modelValue', resolvedSeconds.value)
  }

  function setMode(value: ShortcutMode) {
    const currentSeconds = resolvedSeconds.value ?? props.modelValue
    mode.value = value
    draft.value = draftForMode(value, currentSeconds)
  }
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-ink/55 transition hover:bg-muted hover:text-primary-strong disabled:cursor-not-allowed disabled:opacity-55"
    :disabled="disabled"
    @click="showDialog"
  >
    <Clock3 :size="14" />
    {{ buttonLabel }}
  </button>

  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-[60] grid place-items-center bg-black/35 px-4 backdrop-blur-sm">
        <section class="w-full max-w-md rounded-3xl border border-line bg-panel p-5 shadow-soft">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
                {{ title }}
                <span v-if="resolvedSeconds !== null" class="badge border-primary/25 bg-primary/10 text-primary-strong"> {{ resolvedSeconds }} 秒 </span>
              </h3>
              <p class="mt-1 text-sm text-ink/60">
                {{ helperText }}
              </p>
            </div>
            <button type="button" class="icon-btn" aria-label="关闭" @click="closeDialog">
              <X :size="17" />
            </button>
          </div>

          <div class="mt-5">
            <div v-if="availableModes.length > 1" class="mb-3 flex rounded-2xl border border-line bg-muted p-1">
              <button
                v-for="item in availableModes"
                :key="item.value"
                type="button"
                class="flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition"
                :class="mode === item.value ? 'bg-panel text-primary-strong shadow-sm' : 'text-ink/55 hover:text-ink'"
                :disabled="(item.value === 'remaining' && !canUseRemainingMode) || (item.value === 'duration' && !canUseDurationMode)"
                @click="setMode(item.value)"
              >
                {{ item.label }}
              </button>
            </div>
            <ClearableInput :model-value="draft" :label="inputLabel" placeholder="1:30:00 / 90:00 / 5400" @update:model-value="setDraft" />
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="btn-ghost" @click="closeDialog">取消</button>
            <button type="button" class="btn-primary" @click="closeDialog">完成</button>
          </div>
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
