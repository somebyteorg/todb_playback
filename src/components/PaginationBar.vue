<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ChevronLeft, ChevronRight } from '@lucide/vue'
  import ClearableInput from '@/components/ClearableInput.vue'

  const props = defineProps<{
    page: number
    pageSize: number
    total: number
    disabled?: boolean
  }>()

  const emit = defineEmits<{
    change: [page: number]
  }>()

  const jumpValue = ref<number | null>(null)

  const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
  const pages = computed(() => {
    const list: number[] = []
    const start = Math.max(1, props.page - 2)
    const end = Math.min(totalPages.value, start + 4)
    const normalizedStart = Math.max(1, end - 4)

    for (let item = normalizedStart; item <= end; item += 1) {
      list.push(item)
    }

    return list
  })

  function change(page: number) {
    if (props.disabled) return
    if (page < 1 || page > totalPages.value || page === props.page) return
    emit('change', page)
  }

  function jump() {
    if (!jumpValue.value) return
    change(jumpValue.value)
    jumpValue.value = null
  }

  watch(
    () => props.page,
    () => {
      jumpValue.value = null
    },
  )
</script>

<template>
  <nav v-if="totalPages > 1" class="flex flex-wrap items-end justify-between gap-3" aria-label="分页">
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="icon-btn" :disabled="page <= 1 || disabled" aria-label="上一页" @click="change(page - 1)">
        <ChevronLeft :size="18" />
      </button>
      <button
        v-for="item in pages"
        :key="item"
        type="button"
        class="h-9 min-w-9 rounded-full border px-3 text-sm font-medium transition"
        :class="item === page ? 'border-primary bg-primary text-white' : 'border-line bg-panel text-ink/70 hover:border-primary/45 hover:text-ink'"
        :disabled="disabled"
        @click="change(item)"
      >
        {{ item }}
      </button>
      <button type="button" class="icon-btn" :disabled="page >= totalPages || disabled" aria-label="下一页" @click="change(page + 1)">
        <ChevronRight :size="18" />
      </button>
    </div>
    <div class="flex items-end gap-2">
      <ClearableInput v-model="jumpValue" class="w-32" type="number" :min="1" :max="totalPages" label="跳转" placeholder="页码" :clearable="false" />
      <button type="button" class="btn-secondary self-end" :disabled="disabled || !jumpValue" @click="jump">跳转</button>
    </div>
  </nav>
</template>
