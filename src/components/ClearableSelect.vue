<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
  import { onClickOutside } from '@vueuse/core'
  import { Check, ChevronDown, Search, X } from '@lucide/vue'

  export interface SelectOption {
    value: string | number
    label: string
    description?: string
    searchText?: string
  }

  const props = withDefaults(
    defineProps<{
      modelValue: string | number | null | undefined
      label?: string
      options: SelectOption[]
      disabled?: boolean
      clearable?: boolean
      clearValue?: string | number | null
      searchable?: boolean
      searchPlaceholder?: string
      maxVisibleOptions?: number
      emptyText?: string
      teleportDropdown?: boolean
    }>(),
    {
      clearable: true,
      clearValue: '',
      searchable: false,
      searchPlaceholder: '搜索',
      maxVisibleOptions: 120,
      emptyText: '没有匹配项',
      teleportDropdown: false,
    },
  )

  const emit = defineEmits<{
    'update:modelValue': [value: string | number | null]
  }>()

  const root = ref<HTMLElement | null>(null)
  const trigger = ref<HTMLElement | null>(null)
  const dropdown = ref<HTMLElement | null>(null)
  const open = ref(false)
  const elevated = ref(false)
  const search = ref('')
  const dropdownStyle = ref<Record<string, string>>({})
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
  const searchTokens = computed(() => normalizeSearchText(search.value).split(' ').filter(Boolean))
  const matchingOptions = computed(() => {
    const tokens = searchTokens.value

    if (!props.searchable || tokens.length === 0) return props.options

    return props.options.filter((option) => optionMatchesSearch(option, tokens))
  })
  const visibleOptions = computed(() => {
    const result = matchingOptions.value.slice(0, props.maxVisibleOptions)

    if (selectedOption.value && !result.some((option) => String(option.value) === value.value)) {
      return [selectedOption.value, ...result.slice(0, Math.max(0, props.maxVisibleOptions - 1))]
    }

    return result
  })
  const limitedText = computed(() => {
    if (matchingOptions.value.length <= visibleOptions.value.length) return ''

    return `已显示 ${visibleOptions.value.length} / ${matchingOptions.value.length} 条，请继续搜索缩小范围`
  })
  const dropdownClass = computed(() =>
    props.teleportDropdown
      ? 'fixed z-[85] overflow-hidden rounded-2xl border border-line bg-panel p-1.5 shadow-[0_18px_48px_rgba(40,51,70,0.18)] backdrop-blur'
      : 'absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] overflow-hidden rounded-2xl border border-line bg-panel p-1.5 shadow-[0_18px_48px_rgba(40,51,70,0.18)] backdrop-blur',
  )

  watch(open, (isOpen) => {
    if (isOpen) {
      elevated.value = true
      void nextTick(updateDropdownPosition)
      addPositionListeners()
      return
    }

    if (!isOpen) {
      search.value = ''
      removePositionListeners()
    }
  })

  onClickOutside(
    root,
    () => {
      open.value = false
    },
    { ignore: [dropdown] },
  )

  onBeforeUnmount(() => {
    removePositionListeners()
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
    search.value = ''
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

  function normalizeSearchText(text: string) {
    return text
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s,，.。:：;；/\\|()[\]{}<>《》"'`~!！?？@#$%^&*_+=\-·]+/g, ' ')
      .trim()
  }

  function compactSearchText(text: string) {
    return text.replace(/\s+/g, '')
  }

  function optionSearchCorpus(option: SelectOption) {
    if (option.searchText !== undefined) {
      return normalizeSearchText(option.searchText)
    }

    return normalizeSearchText([option.label, option.description ?? '', option.value].join(' '))
  }

  function optionMatchesSearch(option: SelectOption, tokens: string[]) {
    const corpus = optionSearchCorpus(option)
    const compactCorpus = compactSearchText(corpus)

    return tokens.every((token) => corpus.includes(token) || compactCorpus.includes(compactSearchText(token)))
  }

  function keepElevated() {
    elevated.value = true
  }

  function clearElevatedAfterLeave() {
    if (!open.value) {
      elevated.value = false
    }
  }

  function updateDropdownPosition() {
    if (!props.teleportDropdown || !trigger.value) return

    const rect = trigger.value.getBoundingClientRect()
    dropdownStyle.value = {
      left: `${rect.left}px`,
      top: `${rect.bottom + 8}px`,
      width: `${rect.width}px`,
    }
  }

  function addPositionListeners() {
    if (!props.teleportDropdown) return

    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
  }

  function removePositionListeners() {
    if (!props.teleportDropdown) return

    window.removeEventListener('resize', updateDropdownPosition)
    window.removeEventListener('scroll', updateDropdownPosition, true)
  }
</script>

<template>
  <div ref="root" class="relative block" :class="elevated ? 'z-[70]' : 'z-0'">
    <span v-if="label" class="mb-1.5 block text-sm font-medium text-ink/75">{{ label }}</span>
    <span ref="trigger" class="group relative block">
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

      <Teleport to="body" :disabled="!teleportDropdown">
        <Transition name="select-pop" @before-enter="keepElevated" @after-leave="clearElevatedAfterLeave">
          <div v-if="open" ref="dropdown" :class="dropdownClass" :style="teleportDropdown ? dropdownStyle : undefined">
            <label v-if="searchable" class="relative mb-1.5 block">
              <Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/38" />
              <input
                v-model="search"
                type="search"
                class="min-h-10 w-full rounded-xl border border-line bg-panel px-9 py-2 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-primary/70 focus:ring-4 focus:ring-primary/15"
                :placeholder="searchPlaceholder"
                @keydown.stop
              />
            </label>
            <div class="max-h-64 overflow-y-auto py-1" role="listbox">
              <button
                v-for="option in visibleOptions"
                :key="`${option.value}`"
                type="button"
                role="option"
                :aria-selected="String(option.value) === value"
                class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition"
                :class="String(option.value) === value ? 'bg-primary/12 text-primary-strong' : 'text-ink/72 hover:bg-muted hover:text-ink'"
                @click="select(option)"
              >
                <span class="min-w-0 flex-1">
                  <span class="block truncate">{{ option.label }}</span>
                  <span v-if="option.description" class="mt-0.5 block truncate text-xs text-ink/48">{{ option.description }}</span>
                </span>
                <Check v-if="String(option.value) === value" :size="16" class="shrink-0" />
              </button>
              <p v-if="visibleOptions.length === 0" class="px-3 py-3 text-center text-sm text-ink/50">{{ emptyText }}</p>
              <p v-else-if="limitedText" class="border-t border-line px-3 py-2 text-xs text-ink/45">{{ limitedText }}</p>
            </div>
          </div>
        </Transition>
      </Teleport>
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
