<script setup lang="ts">
  import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useClipboard } from '@vueuse/core'
  import { CheckCircle2, Copy, ExternalLink, KeyRound, Workflow } from '@lucide/vue'
  import DocsCodeBlock from '@/components/DocsCodeBlock.vue'
  import Tooltip from '@/components/Tooltip.vue'
  import { endpoints, playbackApiBaseUrl, playbackPostmanUrl, quickStartCode, statusCodes, workflowSteps } from '@/data/playbackApiDocs'
  import { useToastStore } from '@/stores/toast'

  const docsNavId = 'docs-nav'
  const navTargets = [
    {
      id: docsNavId,
      title: '接口文档',
    },
    ...endpoints.map((endpoint) => ({
      id: endpoint.id,
      title: `${endpoint.number} ${endpoint.title}`,
    })),
  ]

  const toast = useToastStore()
  const { copy } = useClipboard()
  const activeNavId = ref(docsNavId)
  const docsNavBar = ref<HTMLElement | null>(null)
  const docsNavElement = ref<HTMLElement | null>(null)
  const endpointElements = new Map<string, HTMLElement>()
  const navLinkElements = new Map<string, HTMLElement>()
  let scrollSpyFrame = 0
  let scrollSpyLockedUntil = 0
  let unlockTimer = 0

  function endpointUrl(path: string) {
    return `${playbackApiBaseUrl}${path}`
  }

  function targetElement(anchorId: string) {
    return anchorId === docsNavId ? docsNavElement.value : (endpointElements.get(anchorId) ?? document.getElementById(anchorId))
  }

  function setEndpointRef(endpointId: string, element: unknown) {
    if (element instanceof HTMLElement) {
      endpointElements.set(endpointId, element)
      return
    }

    endpointElements.delete(endpointId)
  }

  function setNavLinkRef(anchorId: string, element: unknown) {
    if (element instanceof HTMLElement) {
      navLinkElements.set(anchorId, element)
      return
    }

    navLinkElements.delete(anchorId)
  }

  function currentAnchorOffset() {
    if (window.innerWidth < 768) return 24
    return (docsNavBar.value?.offsetHeight ?? 0) + 18
  }

  function documentTop(element: HTMLElement) {
    return window.scrollY + element.getBoundingClientRect().top
  }

  function scrollToTarget(target: HTMLElement | null | undefined, behavior: ScrollBehavior) {
    if (!target) return

    const top = documentTop(target) - currentAnchorOffset()
    window.scrollTo({
      top: Math.max(0, top),
      behavior,
    })
  }

  function navigateToAnchor(anchorId: string) {
    const target = targetElement(anchorId)

    activeNavId.value = anchorId

    scrollSpyLockedUntil = Date.now() + 950
    if (unlockTimer) window.clearTimeout(unlockTimer)
    unlockTimer = window.setTimeout(() => {
      scrollSpyLockedUntil = 0
      queueScrollSpyUpdate()
    }, 980)

    scrollToTarget(target, 'smooth')
  }

  function updateActiveEndpointFromScroll() {
    scrollSpyFrame = 0

    const probeTop = window.scrollY + currentAnchorOffset() + 2
    let currentAnchorId = docsNavId

    for (const target of navTargets) {
      const element = targetElement(target.id)
      if (!element) continue

      if (documentTop(element) <= probeTop) {
        currentAnchorId = target.id
        continue
      }

      break
    }

    const reachedPageEnd = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 4
    if (reachedPageEnd) {
      currentAnchorId = navTargets[navTargets.length - 1]?.id ?? docsNavId
    }

    if (activeNavId.value !== currentAnchorId) {
      activeNavId.value = currentAnchorId
    }
  }

  function queueScrollSpyUpdate() {
    if (Date.now() < scrollSpyLockedUntil) return
    if (scrollSpyFrame) return
    scrollSpyFrame = window.requestAnimationFrame(updateActiveEndpointFromScroll)
  }

  async function copyText(value: string, label: string) {
    try {
      await copy(value)
      toast.push(`${label}已复制`, 'success')
    } catch {
      toast.push(`${label}复制失败`, 'error')
    }
  }

  function statusCodeClass(code: string) {
    if (code === '401') return 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-200'
    if (code === '422') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
    return 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200'
  }

  function scrollActiveNavIntoView(anchorId: string) {
    requestAnimationFrame(() => {
      navLinkElements.get(anchorId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    })
  }

  watch(activeNavId, (anchorId) => {
    scrollActiveNavIntoView(anchorId)
  })

  onMounted(async () => {
    await nextTick()
    updateActiveEndpointFromScroll()
    scrollActiveNavIntoView(activeNavId.value)
    window.addEventListener('scroll', queueScrollSpyUpdate, { passive: true })
    window.addEventListener('resize', queueScrollSpyUpdate)
  })

  onBeforeUnmount(() => {
    if (scrollSpyFrame) window.cancelAnimationFrame(scrollSpyFrame)
    if (unlockTimer) window.clearTimeout(unlockTimer)
    window.removeEventListener('scroll', queueScrollSpyUpdate)
    window.removeEventListener('resize', queueScrollSpyUpdate)
  })
</script>

<template>
  <main class="page-shell">
    <section ref="docsNavBar" class="sticky top-0 z-20 hidden border-b border-line/55 bg-page/88 px-5 backdrop-blur md:block md:px-8 lg:px-12">
      <div class="mx-auto flex max-w-[96rem] items-center gap-3 py-2.5">
        <nav class="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="接口文档导航">
          <button
            v-for="target in navTargets"
            :key="target.id"
            :ref="(element) => setNavLinkRef(target.id, element)"
            type="button"
            class="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition"
            :class="activeNavId === target.id ? 'bg-muted text-primary-strong ring-1 ring-line/70' : 'text-ink/54 hover:bg-muted/70 hover:text-ink'"
            :aria-current="activeNavId === target.id ? 'location' : undefined"
            @click="navigateToAnchor(target.id)"
          >
            {{ target.title }}
          </button>
        </nav>

        <span class="h-6 w-px shrink-0 bg-line" aria-hidden="true" />

        <Tooltip text="打开 Postman 项目文档" placement="bottom">
          <a
            :href="playbackPostmanUrl"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Postman 项目文档"
            class="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink/54 transition hover:bg-muted/70 hover:text-primary-strong"
          >
            <ExternalLink :size="17" />
            <span>Postman</span>
          </a>
        </Tooltip>
      </div>
    </section>

    <section :id="docsNavId" ref="docsNavElement" class="relative isolate scroll-mt-20 border-b border-line bg-[linear-gradient(180deg,var(--page-start),var(--page))] px-5 py-10 md:px-8 lg:px-12">
      <div
        class="pointer-events-none absolute inset-0 -z-10 opacity-25 [background-image:linear-gradient(rgba(36,48,47,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(36,48,47,.08)_1px,transparent_1px)] [background-size:34px_34px]"
      />

      <div class="mx-auto grid max-w-[88rem] gap-6 lg:grid-cols-[minmax(0,48rem)_minmax(24rem,34rem)] lg:items-center">
        <div class="min-w-0 py-5 lg:py-12">
          <h1 class="mt-6 max-w-4xl text-4xl font-black leading-tight text-ink md:text-6xl">第三方接入文档</h1>
          <p class="mt-5 max-w-3xl text-base leading-8 text-ink/66 md:text-lg">接口均可匿名调用，不强制携带 Authorization。</p>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <RouterLink :to="{ name: 'keys' }" class="btn-primary min-h-12 px-5 text-base">
              <KeyRound :size="18" />
              获取播放密钥
            </RouterLink>
          </div>
        </div>

        <aside class="min-w-0">
          <DocsCodeBlock :code="quickStartCode" label="cURL" language="bash" copy-label="示例命令" max-height-class="max-h-72" wrap />
          <div class="mt-3 flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-panel/70 px-4 py-3">
            <span class="shrink-0 text-xs font-black uppercase text-ink/42">Base URL</span>
            <code class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-sm font-bold text-ink">{{ playbackApiBaseUrl }}</code>
            <Tooltip text="复制 Base URL">
              <button
                type="button"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink/52 transition hover:bg-muted hover:text-ink focus:outline-none focus:ring-4 focus:ring-primary/15"
                aria-label="复制 Base URL"
                @click="copyText(playbackApiBaseUrl, 'Base URL')"
              >
                <Copy :size="14" />
              </button>
            </Tooltip>
          </div>
        </aside>
      </div>
    </section>

    <section class="mx-auto max-w-[96rem] px-5 py-8 md:px-8 lg:px-12">
      <div class="grid gap-8">
        <section class="rounded-2xl border border-line bg-panel/80 p-5 shadow-sm" aria-label="接入概览">
          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div class="badge bg-muted">
                <Workflow :size="16" />
                推荐路径
              </div>
              <p class="min-w-0 text-sm leading-6 text-ink/56 lg:text-right">先解析 ID，再选择版本，最后按 version_id 拉取时间轴和预览图等数据。</p>
            </div>
            <h2 class="text-2xl font-black text-ink">三步接入</h2>
          </div>

          <ol class="relative mt-6 grid gap-4 lg:grid-cols-3">
            <li v-for="step in workflowSteps" :key="step.id" class="relative min-w-0 rounded-2xl border border-line bg-muted/38 p-4">
              <div class="flex items-start gap-4">
                <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-panel text-sm font-black text-primary-strong ring-1 ring-primary/20">{{ step.id }}</div>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="text-base font-black text-ink">{{ step.title }}</h3>
                    <code class="rounded-full bg-panel px-2.5 py-1 text-xs font-bold text-ink/48 ring-1 ring-line/70">{{ step.endpoint }}</code>
                  </div>
                  <p class="mt-2 text-sm leading-6 text-ink/62">{{ step.detail }}</p>
                </div>
              </div>
            </li>
          </ol>
        </section>

        <section class="grid min-w-0 gap-5" aria-labelledby="endpoint-list-title">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="endpoint-list-title" class="text-2xl font-black text-ink">接口详情</h2>
            </div>
            <p class="max-w-2xl text-sm leading-6 text-ink/56">更新时间: 2026-07-02</p>
          </div>

          <article
            v-for="endpoint in endpoints"
            :id="endpoint.id"
            :key="endpoint.id"
            :ref="(element) => setEndpointRef(endpoint.id, element)"
            class="min-w-0 scroll-mt-28 overflow-hidden rounded-2xl border border-line bg-panel shadow-soft md:scroll-mt-28 lg:scroll-mt-32"
          >
            <header class="border-b border-line p-5 md:p-6">
              <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div class="flex min-w-0 items-start gap-4">
                  <div class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-sm" :class="endpoint.accentClass">
                    <component :is="endpoint.icon" :size="24" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex min-w-0 items-center gap-3">
                      <span class="grid h-8 min-w-10 shrink-0 place-items-center rounded-full bg-ink px-3 text-xs font-black text-panel">{{ endpoint.number }}</span>
                      <h3 class="min-w-0 text-2xl font-black leading-tight text-ink md:text-3xl">{{ endpoint.title }}</h3>
                    </div>
                    <p class="mt-3 max-w-3xl text-sm leading-7 text-ink/62">{{ endpoint.description }}</p>
                  </div>
                </div>

                <div class="flex min-w-0 shrink-0 items-center gap-2 rounded-xl border border-line bg-muted/55 px-2 py-2">
                  <span class="rounded-lg bg-primary/12 px-2.5 py-1 text-xs font-black text-primary-strong">POST</span>
                  <code class="min-w-0 truncate text-sm font-bold text-ink">{{ endpoint.path }}</code>
                  <Tooltip :text="`复制 ${endpoint.number} 完整请求地址`">
                    <button
                      type="button"
                      class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink/52 transition hover:bg-panel hover:text-ink focus:outline-none focus:ring-4 focus:ring-primary/15"
                      :aria-label="`复制 ${endpoint.number} 完整请求地址`"
                      @click="copyText(endpointUrl(endpoint.path), `${endpoint.number} 地址`)"
                    >
                      <Copy :size="14" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </header>

            <div class="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
              <div class="min-w-0 border-b border-line p-5 md:p-6 xl:border-b-0 xl:border-r">
                <h4 class="text-sm font-black text-ink">请求参数</h4>

                <div v-if="endpoint.params.length" class="mt-4 max-w-full overflow-x-auto rounded-2xl border border-line">
                  <table class="w-full min-w-[42rem] border-collapse text-left text-sm md:min-w-full">
                    <thead class="bg-muted text-xs font-black text-ink/52">
                      <tr>
                        <th scope="col" class="w-[9.5rem] px-3 py-2">字段</th>
                        <th scope="col" class="w-[9rem] px-3 py-2">类型</th>
                        <th scope="col" class="px-3 py-2">说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="param in endpoint.params" :key="`${endpoint.id}-${param.name}`" class="border-t border-line align-top">
                        <th scope="row" class="px-3 py-3 text-left">
                          <code class="break-all font-bold text-ink">{{ param.name }}</code>
                        </th>
                        <td class="px-3 py-3">
                          <code class="break-all text-ink/56">{{ param.type }}</code>
                        </td>
                        <td class="px-3 py-3">
                          <p class="leading-6 text-ink/62">{{ param.description }}</p>
                          <div v-if="param.values?.length" class="mt-2 grid gap-1.5">
                            <div
                              v-for="value in param.values"
                              :key="`${endpoint.id}-${param.name}-${value.value}`"
                              class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-muted/65 px-2.5 py-2"
                            >
                              <code class="break-all text-xs font-black text-primary-strong">{{ value.value }}</code>
                              <span class="text-xs font-semibold text-ink/58">{{ value.label }}</span>
                              <span v-if="value.detail" class="text-xs leading-5 text-ink/45">{{ value.detail }}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="empty-box mt-4 py-6">无需请求 Body。</div>

                <div v-if="endpoint.responseEnums?.length" class="mt-5 border-t border-line pt-5">
                  <div v-for="responseEnum in endpoint.responseEnums" :key="`${endpoint.id}-${responseEnum.field}`" class="min-w-0">
                    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h5 class="text-sm font-black text-ink">响应字段取值</h5>
                        <p class="mt-1 text-sm leading-6 text-ink/56">{{ responseEnum.description }}</p>
                      </div>
                      <code class="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-black text-primary-strong">{{ responseEnum.path }}</code>
                    </div>

                    <div class="mt-3 grid gap-2 sm:grid-cols-2">
                      <div v-for="value in responseEnum.values" :key="`${endpoint.id}-${responseEnum.field}-${value.value}`" class="min-w-0 rounded-xl border border-line bg-muted/45 px-3 py-2">
                        <code class="block break-all text-xs font-black text-ink">{{ value.value }}</code>
                        <span class="mt-1 block text-sm font-semibold text-ink/56">{{ value.label }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mt-5 grid gap-2">
                  <div v-for="note in endpoint.notes" :key="note" class="flex gap-2 text-sm leading-6 text-ink/62">
                    <CheckCircle2 :size="17" class="mt-0.5 shrink-0 text-primary" />
                    <span>{{ note }}</span>
                  </div>
                </div>
              </div>

              <div class="grid min-w-0 gap-5 p-5 md:p-6">
                <DocsCodeBlock :code="endpoint.requestCode" label="Request JSON" language="json" :copy-label="`${endpoint.number} 请求示例`" max-height-class="max-h-80" />
                <DocsCodeBlock
                  :code="endpoint.responseCode"
                  label="Response JSON"
                  language="json"
                  :status="endpoint.responseStatus"
                  :copy-label="`${endpoint.number} 响应示例`"
                  max-height-class="max-h-96"
                />
              </div>
            </div>
          </article>
        </section>

        <section class="rounded-2xl border border-line bg-panel/80 p-5 shadow-sm" aria-labelledby="status-code-title">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div class="badge bg-muted">
                <CheckCircle2 :size="16" />
                错误处理
              </div>
              <h2 id="status-code-title" class="mt-3 text-2xl font-black text-ink">状态码</h2>
            </div>
            <p class="max-w-xl text-sm leading-6 text-ink/56">均为 HTTP 响应状态码</p>
          </div>

          <div class="mt-5 grid gap-3 md:grid-cols-3">
            <article v-for="status in statusCodes" :key="status.code" class="rounded-2xl border border-line bg-muted/35 p-4">
              <div class="flex items-center gap-2">
                <code class="rounded-full border px-2.5 py-1 text-xs font-black" :class="statusCodeClass(status.code)">{{ status.code }}</code>
                <h3 class="text-sm font-black text-ink">{{ status.title }}</h3>
              </div>
              <p class="mt-3 text-sm leading-6 text-ink/62">{{ status.detail }}</p>
              <code v-if="status.example" class="mt-3 block max-w-full overflow-x-auto rounded-xl bg-panel/70 px-3 py-2 text-xs font-semibold text-ink/70">{{ status.example }}</code>
            </article>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
