<script setup lang="ts">
  import { ref, watch } from 'vue'
  import Viewer from 'viewerjs'
  import 'viewerjs/dist/viewer.css'
  import { Eye, Loader2, Trash2 } from '@lucide/vue'
  import SpriteCreateForm from '@/components/SpriteCreateForm.vue'
  import { useConfirmStore } from '@/stores/confirm'
  import { useToastStore } from '@/stores/toast'
  import { deleteSprite, listSpriteImages } from '@/utils/playback'
  import { formatDateTime } from '@/utils/format'
  import type { SpriteWithImages } from '@/types/api'

  const props = defineProps<{
    versionId: number
    duration: number | null
    canEdit: boolean
    sprites: SpriteWithImages[]
    loading?: boolean
  }>()

  const emit = defineEmits<{
    refresh: []
  }>()

  const confirm = useConfirmStore()
  const toast = useToastStore()
  const previewLoadingSpriteId = ref<number | null>(null)
  const spriteImageCache = ref<Record<number, string[]>>({})

  async function removeSprite(sprite: SpriteWithImages) {
    const ok = await confirm.ask({
      title: '删除时间轴预览图',
      message: `确认删除「${sprite.sprite_name}」？这个操作不能撤销。`,
      danger: true,
    })

    if (!ok) return
    await deleteSprite(props.versionId, sprite.sprite_id)
    clearSpriteImageCache(sprite.sprite_id)
    toast.push('时间轴预览图已删除', 'success')
    emit('refresh')
  }

  function avatarLabel(sprite: SpriteWithImages) {
    return (sprite.user_nickname || '用户').slice(0, 1).toUpperCase()
  }

  function uploaderName(sprite: SpriteWithImages) {
    if (sprite.is_self) return sprite.user_nickname || '自己'
    return sprite.user_nickname || '其他用户'
  }

  async function openSpriteViewer(sprite: SpriteWithImages) {
    if (previewLoadingSpriteId.value !== null) return

    let images = spriteImageCache.value[sprite.sprite_id]
    if (!images) {
      previewLoadingSpriteId.value = sprite.sprite_id

      try {
        images = await listSpriteImages(props.versionId, sprite.sprite_id)
        spriteImageCache.value = {
          ...spriteImageCache.value,
          [sprite.sprite_id]: images,
        }
      } catch {
        toast.push('预览图片加载失败', 'error')
        return
      } finally {
        previewLoadingSpriteId.value = null
      }
    }

    if (images.length === 0) {
      toast.push('当前预览图没有可查看的图片', 'error')
      return
    }

    const container = document.createElement('div')
    container.className = 'hidden'
    images.forEach((image, index) => {
      const img = document.createElement('img')
      img.src = image
      img.alt = `${sprite.user_nickname ? `@${sprite.user_nickname} ` : ''}# ${index + 1}`
      container.appendChild(img)
    })

    document.body.appendChild(container)
    const viewer = new Viewer(container, {
      hidden() {
        viewer.destroy()
        container.remove()
      },
      initialViewIndex: 0,
      navbar: true,
      title: [1, (image: HTMLImageElement) => image.alt],
      toolbar: {
        zoomIn: true,
        zoomOut: true,
        oneToOne: true,
        reset: true,
        prev: true,
        play: true,
        next: true,
        rotateLeft: true,
        rotateRight: true,
      },
      zIndex: 80,
    })
    viewer.show()
  }

  function clearSpriteImageCache(spriteId: number) {
    const { [spriteId]: _removed, ...rest } = spriteImageCache.value
    spriteImageCache.value = rest
  }

  watch(
    () => props.versionId,
    () => {
      spriteImageCache.value = {}
    },
  )

  watch(
    () => props.sprites,
    (sprites) => {
      const spriteIds = new Set(sprites.map((sprite) => sprite.sprite_id))
      const nextCache: Record<number, string[]> = {}

      Object.entries(spriteImageCache.value).forEach(([spriteId, images]) => {
        const normalizedSpriteId = Number(spriteId)
        if (spriteIds.has(normalizedSpriteId)) nextCache[normalizedSpriteId] = images
      })

      spriteImageCache.value = nextCache
    },
  )
</script>

<template>
  <section class="space-y-5">
    <div>
      <h2 class="text-xl font-semibold text-ink">时间轴预览图</h2>
      <p class="mt-1 text-sm text-ink/60">此处为雪碧图上传区域 首次上传请查看帮助</p>
    </div>

    <SpriteCreateForm v-if="canEdit" :version-id="versionId" @created="emit('refresh')" />

    <div v-if="loading" class="grid min-h-40 place-items-center text-ink/55">
      <Loader2 :size="28" class="animate-spin" />
    </div>
    <div v-else-if="sprites.length === 0" class="empty-box">还没有时间轴预览图。</div>
    <div v-else class="overflow-hidden rounded-3xl border border-line bg-panel shadow-soft">
      <article v-for="sprite in sprites" :key="sprite.sprite_id" class="flex flex-col gap-4 border-b border-line px-4 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between">
        <div class="min-w-0 flex-1 space-y-2">
          <h3 class="break-words font-semibold text-ink">{{ sprite.sprite_id }} # {{ sprite.sprite_name }}</h3>
          <p class="mt-1 text-sm text-ink/60">{{ sprite.interval }}s / {{ sprite.width }}x{{ sprite.height }} / {{ sprite.columns }}x{{ sprite.rows }} / {{ sprite.count_frame }} 帧</p>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink/55">
            <span class="inline-flex items-center gap-1.5">
              <img v-if="sprite.user_avatar" :src="sprite.user_avatar" :alt="uploaderName(sprite)" class="h-6 w-6 rounded-full border border-line object-cover" />
              <span v-else class="grid h-6 w-6 place-items-center rounded-full bg-primary/12 text-[11px] font-bold text-primary-strong">
                {{ avatarLabel(sprite) }}
              </span>
              <span>{{ uploaderName(sprite) }}</span>
            </span>
            <span>上传时间 {{ formatDateTime(sprite.created_at) || '-' }}</span>
          </div>
        </div>
        <div class="grid shrink-0 grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:justify-end">
          <button type="button" class="btn-ghost px-3 text-xs md:text-sm" :disabled="previewLoadingSpriteId !== null" @click="openSpriteViewer(sprite)">
            <Loader2 v-if="previewLoadingSpriteId === sprite.sprite_id" :size="16" class="animate-spin" />
            <Eye v-else :size="16" />
            {{ previewLoadingSpriteId === sprite.sprite_id ? '加载中' : '预览图片' }}
          </button>
          <button v-if="canEdit && sprite.is_can_delete" type="button" class="btn-danger px-3 text-xs md:text-sm" @click="removeSprite(sprite)">
            <Trash2 :size="16" />
            删除
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
