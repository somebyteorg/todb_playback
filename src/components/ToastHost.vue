<script setup lang="ts">
  import { CheckCircle2, Info, X, XCircle } from '@lucide/vue'
  import { useToastStore } from '@/stores/toast'

  const toast = useToastStore()
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
      <TransitionGroup name="toast">
        <div v-for="item in toast.items" :key="item.id" class="pointer-events-auto flex items-start gap-3 rounded-2xl border border-line bg-panel/95 p-4 text-sm shadow-soft backdrop-blur">
          <CheckCircle2 v-if="item.type === 'success'" class="mt-0.5 shrink-0 text-emerald-500" :size="20" />
          <XCircle v-else-if="item.type === 'error'" class="mt-0.5 shrink-0 text-rose-500" :size="20" />
          <Info v-else class="mt-0.5 shrink-0 text-sky-500" :size="20" />
          <p class="min-w-0 flex-1 leading-6 text-ink">{{ item.message }}</p>
          <button
            type="button"
            class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/45 transition hover:bg-ink/10 hover:text-ink"
            aria-label="关闭通知"
            @click="toast.remove(item.id)"
          >
            <X :size="15" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
  .toast-enter-active,
  .toast-leave-active {
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }

  .toast-enter-from,
  .toast-leave-to {
    opacity: 0;
    transform: translateY(-10px) scale(0.98);
  }

  .toast-move {
    transition: transform 180ms ease;
  }
</style>
