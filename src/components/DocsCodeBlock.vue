<script setup lang="ts">
  import { computed } from 'vue'
  import { useClipboard } from '@vueuse/core'
  import { Check, Copy } from '@lucide/vue'
  import hljs from 'highlight.js/lib/core'
  import bash from 'highlight.js/lib/languages/bash'
  import json from 'highlight.js/lib/languages/json'
  import Tooltip from '@/components/Tooltip.vue'
  import { useToastStore } from '@/stores/toast'

  type CodeLanguage = 'json' | 'bash'

  const props = withDefaults(
    defineProps<{
      code: string
      label: string
      language?: CodeLanguage
      copyLabel?: string
      maxHeightClass?: string
      status?: string
      wrap?: boolean
    }>(),
    {
      language: 'json',
      maxHeightClass: 'max-h-96',
      status: '',
      wrap: false,
    },
  )

  hljs.registerLanguage('json', json)
  hljs.registerLanguage('bash', bash)

  const toast = useToastStore()
  const { copy, copied } = useClipboard()

  const highlightedCode = computed(() => {
    return hljs.highlight(props.code, {
      language: props.language,
      ignoreIllegals: true,
    }).value
  })

  async function copyCode() {
    try {
      await copy(props.code)
      toast.push(`${props.copyLabel || props.label}已复制`, 'success')
    } catch {
      toast.push(`${props.copyLabel || props.label}复制失败`, 'error')
    }
  }
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-line bg-[#111615] shadow-sm">
    <div class="flex min-h-11 items-center justify-between gap-3 border-b border-white/10 bg-white/[.035] px-3 py-2">
      <div class="flex min-w-0 items-center gap-2">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
        <span class="truncate text-xs font-black uppercase tracking-normal text-white/72">{{ label }}</span>
        <code v-if="status" class="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[0.7rem] font-black text-emerald-200">{{ status }}</code>
      </div>

      <Tooltip :text="`复制 ${copyLabel || label}`" placement="left">
        <button
          type="button"
          class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-primary/25"
          :aria-label="`复制 ${copyLabel || label}`"
          @click="copyCode"
        >
          <Check v-if="copied" :size="15" />
          <Copy v-else :size="15" />
        </button>
      </Tooltip>
    </div>

    <pre
      class="max-w-full overflow-y-auto p-4 text-sm leading-7 text-slate-100"
      :class="[maxHeightClass, wrap ? 'overflow-x-hidden' : 'overflow-x-auto']"
    ><code class="hljs" :class="[`language-${language}`, { 'docs-code-wrap': wrap }]" v-html="highlightedCode" /></pre>
  </section>
</template>

<style scoped>
  :deep(.hljs) {
    display: block;
    min-width: max-content;
    background: transparent;
    color: #d7e7df;
  }

  :deep(.docs-code-wrap) {
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  :deep(.hljs-attr) {
    color: #7dd3fc;
  }

  :deep(.hljs-string) {
    color: #86efac;
  }

  :deep(.hljs-number),
  :deep(.hljs-literal) {
    color: #fbbf24;
  }

  :deep(.hljs-keyword),
  :deep(.hljs-built_in) {
    color: #c4b5fd;
  }

  :deep(.hljs-variable),
  :deep(.hljs-params) {
    color: #f0abfc;
  }

  :deep(.hljs-comment) {
    color: #94a3b8;
  }
</style>
