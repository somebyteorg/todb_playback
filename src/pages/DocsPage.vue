<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useClipboard } from '@vueuse/core'
  import { CheckCircle2, Copy, ExternalLink, FileJson, KeyRound } from '@lucide/vue'
  import DocsCodeBlock from '@/components/DocsCodeBlock.vue'
  import Tooltip from '@/components/Tooltip.vue'
  import { useToastStore } from '@/stores/toast'
  import { markerTypeOptions } from '@/utils/format'

  const playbackApiBaseUrl = 'https://playback.theotherdb.org/api'
  const playbackPostmanUrl = 'https://www.postman.com/somebyteorg/todb'

  function prettyJson(value: unknown) {
    return JSON.stringify(value, null, 2)
  }

  const quickStartCode = `curl -X POST '${playbackApiBaseUrl}/metadata' \\
  -H 'Content-Type: application/json' \\
  -d '${prettyJson({
    platform_type: 'tmdb_id_movie',
    platform_value: '83533',
  })}'`

  const endpoint = {
    id: 'endpoint-1-3',
    number: '1.3',
    title: '获取视频元数据',
    path: '/metadata',
    description: '获取可播放版本以及元数据。',
  }

  const videoExamples = [
    {
      id: 'movie',
      title: '电影',
      description: '通过 TMDB  ID 查询电影元数据。',
      requestCode: prettyJson({
        platform_type: 'tmdb_id_movie',
        platform_value: '83533',
        includes: ['marker', 'sprite'],
        page: 1,
        page_size: 1,
      }),
      responseStatus: '200 OK',
      responseCode: prettyJson({
        page: 1,
        page_size: 1,
        has_more: false,
        items: [
          {
            version_id: 100,
            version_name: '优酷',
            version_description: null,
            version_runtime: 11369,
            version_platform: 'youku',
            todbv_id: 100,
            video_type: 'movie',
            base_video_list: {
              video_type: 'movie',
              video_title: '阿凡达：火与烬',
            },
            base_video_season: null,
            base_video_episode: null,
            marker: [
              {
                marker_id: 106,
                marker_type: 'chapter',
                title: '杰克收集枪支誓报仇，遭罗娜尔出言训斥',
                time_start: 389,
                time_end: null,
                user_avatar_url: 'https://playback.local/avatar.jpg',
                user_nickname: 'soa',
              },
            ],
            sprite: [
              {
                sprite_id: 105,
                width: 352,
                height: 198,
                vtt_url: 'https://playback.local/movie.vtt?v=260701',
              },
            ],
          },
        ],
      }),
    },
    {
      id: 'tv',
      title: '电视',
      description: '通过 TMDB ID 查询电视元数据。',
      requestCode: prettyJson({
        platform_type: 'tmdb_id_tv',
        platform_value: '226045',
        season_number: 1,
        episode_number: 1,
        includes: ['base_video_list', 'base_video_season', 'base_video_episode', 'marker', 'sprite'],
        page: 1,
        page_size: 1,
      }),
      responseStatus: '200 OK',
      responseCode: prettyJson({
        page: 1,
        page_size: 1,
        has_more: true,
        items: [
          {
            version_id: 101,
            version_name: '爱奇艺',
            version_description: null,
            version_runtime: 1300,
            version_platform: 'iqiyi',
            todbv_id: 102,
            video_type: 'tv',
            base_video_list: {
              video_type: 'tv',
              video_title: '大主宰',
            },
            base_video_season: {
              season_number: 1,
              season_title: '第 1 季',
              date_air: '2023-06-30',
            },
            base_video_episode: {
              episode_number: 1,
              episode_title: '逐出灵路',
            },
            marker: [
              {
                marker_id: 104,
                marker_type: 'intro',
                title: null,
                time_start: 0,
                time_end: 27,
                user_avatar_url: null,
                user_nickname: null,
              },
            ],
            sprite: [
              {
                sprite_id: 103,
                width: 400,
                height: 225,
                vtt_url: 'https://playback.local/tv.vtt?v=260701',
              },
            ],
          },
        ],
      }),
    },
  ]
  const activeExampleId = ref(videoExamples[0]?.id ?? '')
  const activeVideoExample = computed(() => videoExamples.find((example) => example.id === activeExampleId.value) ?? videoExamples[0])

  const params = [
    {
      name: 'platform_type',
      type: 'string|null',
      description: '第三方平台类型，与 platform_value 配套使用。',
      values: [
        { value: 'tmdb_id_tv', label: 'TMDB 剧集' },
        { value: 'tmdb_id_movie', label: 'TMDB 电影' },
      ],
    },
    { name: 'platform_value', type: 'string|null', description: '第三方平台内容 ID。' },
    { name: 'version_id', type: 'number|null', description: '版本 ID，可直接定位某个播放版本。' },
    { name: 'todbv_id', type: 'number|null', description: 'TODB 视频 ID。' },
    { name: 'season_number', type: 'number|null', description: '电视季数。' },
    { name: 'episode_number', type: 'number|null', description: '电视集数。' },
    {
      name: 'includes',
      type: 'string[]|null',
      description: '需要包含那些数据。',
      values: [
        { value: 'base_video_list', label: '视频基础信息' },
        { value: 'base_video_season', label: '季信息' },
        { value: 'base_video_episode', label: '集信息' },
        { value: 'marker', label: '时间轴标记', detail: '响应中有概率时间重叠' },
        { value: 'sprite', label: '雪碧图规则' },
      ],
    },
    { name: 'page', type: 'number|null', description: '页码，从 1 开始。' },
    { name: 'page_size', type: 'number|null', description: '每页条数，范围 1 到 30。' },
  ]

  const markerTypeValues = markerTypeOptions.map(({ value, label }) => ({ value, label }))
  const notes = ['page_size 每页条数范围为 1 到 30。']

  const toast = useToastStore()
  const { copy } = useClipboard()

  function endpointUrl(path: string) {
    return `${playbackApiBaseUrl}${path}`
  }

  async function copyText(value: string, label: string) {
    try {
      await copy(value)
      toast.push(`${label}已复制`, 'success')
    } catch {
      toast.push(`${label}复制失败`, 'error')
    }
  }
</script>

<template>
  <main class="page-shell">
    <section class="relative isolate border-b border-line bg-[linear-gradient(180deg,var(--page-start),var(--page))] px-5 py-10 md:px-8 lg:px-12">
      <div
        class="pointer-events-none absolute inset-0 -z-10 opacity-25 [background-image:linear-gradient(rgba(36,48,47,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(36,48,47,.08)_1px,transparent_1px)] [background-size:34px_34px]"
      />

      <div class="mx-auto grid max-w-[88rem] gap-6 lg:grid-cols-[minmax(0,48rem)_minmax(24rem,34rem)] lg:items-center">
        <div class="min-w-0 py-5 lg:py-12">
          <h1 class="mt-6 max-w-4xl text-4xl font-black leading-tight text-ink md:text-6xl">MetaData 元数据接口</h1>
          <p class="mt-5 max-w-3xl text-base leading-8 text-ink/66 md:text-lg">只需一个接口，无需登录即可调用。</p>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <RouterLink :to="{ name: 'keys' }" class="btn-primary min-h-12 px-5 text-base">
              <KeyRound :size="18" />
              获取播放密钥
            </RouterLink>
            <a
              :href="playbackPostmanUrl"
              target="_blank"
              rel="noreferrer noopener"
              class="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-panel px-5 text-base font-black text-ink/68 shadow-sm transition hover:bg-muted hover:text-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/15"
            >
              <ExternalLink :size="18" />
              <span>Postman</span>
            </a>
          </div>
        </div>

        <aside class="min-w-0">
          <DocsCodeBlock :code="quickStartCode" label="cURL" language="bash" copy-label="示例命令" max-height-class="max-h-80" />
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
      <div class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 class="text-2xl font-black text-ink">接口说明</h2>
        <p class="max-w-2xl text-sm leading-6 text-ink/56">更新时间: 2026-07-05</p>
      </div>

      <article :id="endpoint.id" class="min-w-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-soft">
        <header class="border-b border-line p-5 md:p-6">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="flex min-w-0 items-start gap-4">
              <div class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-500 text-white shadow-sm">
                <FileJson :size="24" />
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

        <div class="grid min-w-0 gap-0 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
          <section class="min-w-0 border-b border-line p-5 md:p-6 lg:border-b-0 lg:border-r">
            <h4 class="text-sm font-black text-ink">请求字段</h4>

            <div v-if="params.length" class="mt-4 max-w-full overflow-x-auto rounded-2xl border border-line">
              <table class="w-full min-w-[42rem] border-collapse text-left text-sm md:min-w-full">
                <thead class="bg-muted text-xs font-black text-ink/52">
                  <tr>
                    <th scope="col" class="w-[9.5rem] px-3 py-2">字段</th>
                    <th scope="col" class="w-[9rem] px-3 py-2">类型</th>
                    <th scope="col" class="px-3 py-2">说明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="param in params" :key="param.name" class="border-t border-line align-top">
                    <th scope="row" class="px-3 py-3 text-left">
                      <code class="break-all font-bold text-ink">{{ param.name }}</code>
                    </th>
                    <td class="px-3 py-3">
                      <code class="break-all text-ink/56">{{ param.type }}</code>
                    </td>
                    <td class="px-3 py-3">
                      <p class="leading-6 text-ink/62">{{ param.description }}</p>
                      <div v-if="param.values?.length" class="mt-2 grid gap-1.5">
                        <div v-for="value in param.values" :key="`${param.name}-${value.value}`" class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-muted/65 px-2.5 py-2">
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

            <div class="mt-5 border-t border-line pt-5">
              <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h5 class="text-sm font-black text-ink">响应字段取值</h5>
                  <p class="mt-1 text-sm leading-6 text-ink/56">marker_type 标识时间轴标记的用途。</p>
                </div>
                <code class="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-black text-primary-strong">items[].marker[].marker_type</code>
              </div>

              <div class="mt-3 grid gap-2 sm:grid-cols-2">
                <div v-for="value in markerTypeValues" :key="value.value" class="min-w-0 rounded-xl border border-line bg-muted/45 px-3 py-2">
                  <code class="block break-all text-xs font-black text-ink">{{ value.value }}</code>
                  <span class="mt-1 block text-sm font-semibold text-ink/56">{{ value.label }}</span>
                </div>
              </div>
            </div>

            <div class="mt-5 grid gap-2">
              <div v-for="note in notes" :key="note" class="flex gap-2 text-sm leading-6 text-ink/62">
                <CheckCircle2 :size="17" class="mt-0.5 shrink-0 text-primary" />
                <span>{{ note }}</span>
              </div>
            </div>
          </section>

          <section class="grid min-w-0 gap-5 p-5 md:p-6" aria-label="示例">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h4 class="text-sm font-black text-ink">请求示例</h4>
                <p class="mt-1 text-sm leading-6 text-ink/56">以下为精简字段，具体以postman为准。</p>
              </div>
            </div>

            <div class="min-w-0 overflow-x-auto rounded-2xl border border-line bg-muted/35 p-1" role="tablist" aria-label="示例场景">
              <div class="grid min-w-[14rem] grid-cols-2 gap-1">
                <button
                  v-for="example in videoExamples"
                  :id="`example-tab-${example.id}`"
                  :key="example.id"
                  type="button"
                  role="tab"
                  class="min-h-10 rounded-xl px-3 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-primary/15"
                  :class="activeExampleId === example.id ? 'bg-panel text-primary-strong shadow-sm ring-1 ring-line/70' : 'text-ink/54 hover:bg-panel/70 hover:text-ink'"
                  :aria-selected="activeExampleId === example.id"
                  :aria-controls="`example-panel-${example.id}`"
                  @click="activeExampleId = example.id"
                >
                  {{ example.title }}
                </button>
              </div>
            </div>

            <section v-if="activeVideoExample" :id="`example-panel-${activeVideoExample.id}`" class="min-w-0" role="tabpanel" :aria-labelledby="`example-tab-${activeVideoExample.id}`">
              <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 class="text-sm font-black text-ink">{{ activeVideoExample.title }}</h4>
                  <p class="mt-1 text-sm leading-6 text-ink/56">{{ activeVideoExample.description }}</p>
                </div>
                <code class="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-black text-primary-strong">{{ activeVideoExample.responseStatus }}</code>
              </div>

              <div class="mt-4 grid min-w-0 gap-4">
                <DocsCodeBlock :code="activeVideoExample.requestCode" label="Request JSON" language="json" :copy-label="`${activeVideoExample.title}请求示例`" max-height-class="max-h-none" />
                <DocsCodeBlock
                  :code="activeVideoExample.responseCode"
                  label="Response JSON"
                  language="json"
                  :status="activeVideoExample.responseStatus"
                  :copy-label="`${activeVideoExample.title}响应示例`"
                  max-height-class="max-h-none"
                />
              </div>
            </section>
          </section>
        </div>
      </article>
    </section>
  </main>
</template>
