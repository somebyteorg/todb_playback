<script setup lang="ts">
  import { AlertTriangle, X } from '@lucide/vue'
  import { useConfirmStore } from '@/stores/confirm'

  const confirm = useConfirmStore()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="confirm.current" class="fixed inset-0 z-[70] grid place-items-center bg-black/35 px-4 backdrop-blur-sm">
        <section class="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-soft">
          <div class="flex items-start gap-3">
            <div class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle :size="20" />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-lg font-semibold text-ink">{{ confirm.current.title }}</h2>
              <p class="mt-2 text-sm leading-6 text-ink/70">{{ confirm.current.message }}</p>
            </div>
            <button type="button" class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/45 transition hover:bg-ink/10 hover:text-ink" aria-label="关闭" @click="confirm.answer(false)">
              <X :size="16" />
            </button>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="btn-ghost" @click="confirm.answer(false)">取消</button>
            <button type="button" :class="confirm.current.danger ? 'btn-danger' : 'btn-primary'" @click="confirm.answer(true)">确认</button>
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
