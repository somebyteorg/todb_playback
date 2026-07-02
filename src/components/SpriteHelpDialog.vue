<script setup lang="ts">
  import { X } from '@lucide/vue'

  defineProps<{
    open: boolean
  }>()

  const emit = defineEmits<{
    close: []
  }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 backdrop-blur-sm">
        <section class="w-full max-w-lg rounded-3xl border border-line bg-panel p-5 shadow-soft">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-ink">预览图参数帮助</h3>
              <p class="mt-1 text-sm text-ink/60">间隔秒默认使用 10，表示每隔 10 秒取一帧。</p>
            </div>
            <button type="button" class="icon-btn" aria-label="关闭" @click="emit('close')">
              <X :size="17" />
            </button>
          </div>

          <div class="mt-5 grid gap-4">
            <div class="rounded-2xl border border-line bg-muted p-4">
              <h4 class="text-sm font-semibold text-ink">建议分辨率</h4>
              <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <span class="badge justify-center">160x90</span>
                <span class="badge justify-center">240x135</span>
                <span class="badge justify-center">320x180</span>
                <span class="badge justify-center">640x360</span>
                <span class="badge justify-center">1920x1080</span>
              </div>
            </div>
            <div class="grid gap-2 text-sm leading-6 text-ink/65">
              <p>列数和行数对应单张雪碧图内的网格数量。</p>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
