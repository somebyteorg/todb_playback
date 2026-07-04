<script setup lang="ts">
  import { computed } from 'vue'

  type FilterKey = 'versioned' | 'released'

  const props = defineProps<{
    versionedOnly: boolean
    releasedOnly: boolean
  }>()

  const emit = defineEmits<{
    toggleVersioned: []
    toggleReleased: []
  }>()

  const filters = computed(() => [
    {
      key: 'versioned' as const,
      label: '有版本',
      active: props.versionedOnly,
      ariaLabel: '仅显示有版本的集',
    },
    {
      key: 'released' as const,
      label: '已播出',
      active: props.releasedOnly,
      ariaLabel: '仅显示已播出或有版本的集',
    },
  ])

  function toggleFilter(key: FilterKey) {
    if (key === 'versioned') {
      emit('toggleVersioned')
      return
    }

    emit('toggleReleased')
  }
</script>

<template>
  <div class="ml-auto flex shrink-0 gap-1.5 rounded-xl border border-line bg-muted/55 p-1.5">
    <button
      v-for="filter in filters"
      :key="filter.key"
      type="button"
      role="switch"
      class="flex h-7 w-26 items-center justify-between gap-2 rounded-xl border px-2 text-xs font-semibold transition focus:outline-none focus:ring-4 focus:ring-primary/15"
      :class="filter.active ? 'border-primary/20 bg-panel text-primary-strong shadow-sm' : 'border-transparent text-ink/58 hover:bg-panel/70 hover:text-ink'"
      :aria-checked="filter.active"
      :aria-label="filter.ariaLabel"
      @click="toggleFilter(filter.key)"
    >
      <span>{{ filter.label }}</span>
      <span class="relative h-5 w-9 rounded-full transition sm:h-4 sm:w-7" :class="filter.active ? 'bg-primary' : 'bg-muted'">
        <span class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-panel shadow-sm transition sm:h-3 sm:w-3" :class="filter.active ? 'translate-x-4 sm:translate-x-3' : 'translate-x-0'" />
      </span>
    </button>
  </div>
</template>
