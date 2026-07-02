<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { onClickOutside } from '@vueuse/core'
  import { Check, ChevronDown, X } from '@lucide/vue'

  export interface SelectOption {
    value: string | number
    label: string
  }

  const props = withDefaults(
    defineProps<{
      modelValue: string | number | null | undefined
      label?: string
      options: SelectOption[]
      disabled?: boolean
      clearable?: boolean
      clearValue?: string | number | null
    }>(),
    {
      clearable: true,
      clearValue: '',
    },
  )

  const emit = defineEmits<{
    'update:modelValue': [value: string | number | null]
  }>()

  const root = ref<HTMLElement | null>(null)
  const open = ref(false)
  const value = computed({
    get: () => String(props.modelValue ?? ''),
    set: (next: string) => {
      const option = props.options.find((item) => String(item.value) === next)
      emit('update:modelValue', option?.value ?? next)
    },
  })

  const canClear = computed(() => {
    return props.clearable && !props.disabled && value.value !== String(props.clearValue ?? '')
  })
  const selectedOption = computed(() => props.options.find((item) => String(item.value) === value.value) ?? null)

  onClickOutside(root, () => {
    open.value = false
  })

  function toggle() {
    if (props.disabled) return
    open.value = !open.value
  }

  function select(option: SelectOption) {
    emit('update:modelValue', option.value)
    open.value = false
  }

  function clear() {
    emit('update:modelValue', props.clearValue)
    open.value = false
  }

  function onTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      open.value = false
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
  }
</script>

<template>
  <div ref="root" class="block">
    <span v-if="label" class="mb-1.5 block text-sm font-medium text-ink/75">{{ label }}</span>
    <span class="group relative block">
      <button
        type="button"
        :disabled="disabled"
        class="field select-field flex h-[46px] items-center justify-between gap-3 text-left"
        :class="[canClear ? 'pr-20' : 'pr-11', open ? 'border-primary/70 ring-4 ring-primary/15' : '']"
        :aria-label="label"
        :aria-expanded="open"
        aria-haspopup="listbox"
        @click="toggle"
        @keydown="onTriggerKeydown"
      >
        <span class="min-w-0 truncate">{{ selectedOption?.label ?? '请选择' }}</span>
      </button>
      <span v-if="canClear" class="absolute right-10 top-1/2 z-10 -translate-y-1/2">
        <button
          type="button"
          class="grid h-7 w-7 place-items-center rounded-full text-ink/42 transition hover:bg-ink/10 hover:text-ink"
          aria-label="清空"
          @pointerdown.stop.prevent
          @click.stop="clear"
        >
          <X :size="15" />
        </button>
      </span>
      <span class="pointer-events-none absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink/45 transition group-focus-within:text-primary">
        <ChevronDown :size="17" class="transition" :class="open ? 'rotate-180' : ''" />
      </span>

      <Transition name="select-pop">
        <div
          v-if="open"
          class="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-line bg-panel p-1.5 shadow-[0_18px_48px_rgba(40,51,70,0.18)] backdrop-blur"
        >
          <div class="max-h-64 overflow-y-auto py-1" role="listbox">
            <button
              v-for="option in options"
              :key="`${option.value}`"
              type="button"
              role="option"
              :aria-selected="String(option.value) === value"
              class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition"
              :class="String(option.value) === value ? 'bg-primary/12 text-primary-strong' : 'text-ink/72 hover:bg-muted hover:text-ink'"
              @click="select(option)"
            >
              <span class="min-w-0 truncate">{{ option.label }}</span>
              <Check v-if="String(option.value) === value" :size="16" class="shrink-0" />
            </button>
          </div>
        </div>
      </Transition>
    </span>
  </div>
</template>

<style scoped>
  .select-pop-enter-active,
  .select-pop-leave-active {
    transition:
      opacity 140ms ease,
      transform 140ms ease;
  }

  .select-pop-enter-from,
  .select-pop-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
</style>
