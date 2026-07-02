<script setup lang="ts">
  import { computed } from 'vue'
  import dayjs from 'dayjs'
  import { ArrowUpRight, BookOpen, Database } from '@lucide/vue'

  const slogans = ['每一次播放，都值得更完整。', '让播放器更懂每一部作品。', '让播放器知道什么时候开始，什么时候结束。', '播放，不只是点击开始。', '准备好更智能地观看了吗？']

  const slogan = computed(() => slogans[Math.floor(Math.random() * slogans.length)])
  const currentTime = dayjs()
  const currentClockText = currentTime.format('HH:mm:ss')
  const dayProgressPercent = `${(((currentTime.hour() * 3600 + currentTime.minute() * 60 + currentTime.second()) / 86400) * 100).toFixed(2)}%`
</script>

<template>
  <main class="min-h-screen overflow-hidden bg-page">
    <section class="relative isolate flex min-h-[100svh] items-center px-5 pb-10 pt-24 md:px-12 md:py-12 lg:pl-32">
      <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden hidden md:block">
        <div class="absolute inset-y-16 right-[-22rem] hidden w-[74rem] rounded-l-[4rem] border-y border-l border-line bg-panel/70 shadow-soft backdrop-blur-xl lg:block">
          <div class="absolute left-12 top-12 h-[46%] w-[min(54rem,calc(100vw-38rem))] overflow-hidden rounded-[2rem] border border-line bg-ink/10">
            <div class="absolute inset-0 bg-[linear-gradient(135deg,rgba(17,169,150,.22),rgba(255,177,120,.16)_48%,rgba(36,48,47,.10))]" />
            <div class="absolute left-8 top-8 flex items-center gap-2 rounded-full border border-white/45 bg-panel/75 px-3 py-1.5 text-xs font-semibold text-ink/65 backdrop-blur">SOBY</div>
            <div class="absolute bottom-8 left-8 right-8">
              <div class="h-1.5 overflow-hidden rounded-full bg-panel/60">
                <div class="h-full rounded-full bg-primary" :style="{ width: dayProgressPercent }" />
              </div>
              <div class="mt-4 flex items-center justify-between text-xs font-semibold text-white">
                <span class="rounded-full bg-ink/55 px-3 py-1 backdrop-blur">{{ currentClockText }}</span>
              </div>
            </div>
          </div>

          <div class="absolute bottom-14 left-12 w-[min(54rem,calc(100vw-38rem))] rounded-[2rem] border border-line bg-panel/85 p-6 shadow-soft">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-semibold text-ink">时间轴</p>
                <p class="mt-1 text-xs text-ink/50">片头和片尾、章节与彩蛋</p>
              </div>
            </div>
            <div class="mt-7 grid gap-5">
              <div class="relative h-4 rounded-full bg-ink/10">
                <div class="absolute left-[7%] top-0 h-full w-[16%] rounded-full bg-emerald-500" />
                <div class="absolute left-[38%] top-0 h-full w-4 rounded-full bg-sky-500" />
                <div class="absolute left-[78%] top-0 h-full w-[13%] rounded-full bg-rose-500" />
              </div>
              <div class="grid grid-cols-5 gap-3">
                <div class="aspect-video rounded-xl bg-teal-200" />
                <div class="aspect-video rounded-xl bg-amber-200" />
                <div class="aspect-video rounded-xl bg-sky-200" />
                <div class="aspect-video rounded-xl bg-rose-200" />
                <div class="aspect-video rounded-xl bg-violet-200" />
              </div>
            </div>
          </div>
        </div>

        <div class="absolute inset-x-5 bottom-7 h-[36svh] rounded-[2rem] border border-line bg-panel/76 p-4 shadow-soft backdrop-blur md:hidden">
          <div class="h-[48%] rounded-[1.5rem] bg-ink/10" />
          <div class="mt-5 h-3 rounded-full bg-ink/10">
            <div class="ml-[10%] h-full w-[22%] rounded-full bg-emerald-500" />
          </div>
          <div class="mt-4 grid grid-cols-4 gap-2">
            <div class="aspect-video rounded-lg bg-teal-200" />
            <div class="aspect-video rounded-lg bg-amber-200" />
            <div class="aspect-video rounded-lg bg-sky-200" />
            <div class="aspect-video rounded-lg bg-rose-200" />
          </div>
        </div>
      </div>

      <div class="relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-center">
        <div class="max-w-3xl">
          <div class="inline-flex items-center gap-2 rounded-full border border-line bg-panel/78 px-4 py-2 text-base font-semibold text-ink/70 shadow-sm backdrop-blur">TODB PlayBack</div>
          <h1 class="mt-7 max-w-4xl text-5xl font-black leading-tight text-ink sm:text-6xl md:text-7xl lg:text-8xl">播放资料库</h1>
          <p class="mt-5 max-w-2xl text-2xl font-semibold leading-9 text-ink/76 md:text-3xl md:leading-10">
            {{ slogan }}
          </p>
          <p class="mt-6 max-w-3xl text-lg leading-8 text-ink/62 md:text-xl md:leading-9">管理版本、时间轴、雪碧图与字幕，支持跳过片头片尾、章节导航和画面预览。</p>

          <div class="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <RouterLink :to="{ name: 'browse' }" class="btn-primary min-h-[3.25rem] px-6 text-lg">
              <Database :size="18" />
              浏览数据库
            </RouterLink>
            <RouterLink :to="{ name: 'docs' }" class="btn-secondary min-h-[3.25rem] px-6 text-lg">
              <BookOpen :size="18" />
              接口文档
            </RouterLink>
            <a href="https://theotherdb.org" target="_blank" rel="noreferrer noopener" class="btn-ghost min-h-[3.25rem] px-6 text-lg">
              <ArrowUpRight :size="18" />
              前往主站
            </a>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
