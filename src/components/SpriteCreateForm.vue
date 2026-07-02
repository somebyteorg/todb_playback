<script setup lang="ts">
  import { computed, onBeforeUnmount, ref } from 'vue'
  import { CircleHelp, Loader2, Plus } from '@lucide/vue'
  import ClearableInput from '@/components/ClearableInput.vue'
  import SpriteAssetDraftList from '@/components/SpriteAssetDraftList.vue'
  import SpriteHelpDialog from '@/components/SpriteHelpDialog.vue'
  import Tooltip from '@/components/Tooltip.vue'
  import { useToastStore } from '@/stores/toast'
  import { createSprite, uploadPlaybackAsset } from '@/utils/playback'
  import type { SpriteAssetDraft } from '@/types/sprite'

  type SpriteNumberKey = 'interval' | 'width' | 'height' | 'columns' | 'rows' | 'count_frame'

  const props = defineProps<{
    versionId: number
  }>()

  const emit = defineEmits<{
    created: []
  }>()

  const toast = useToastStore()
  const uploading = ref(false)
  const creating = ref(false)
  const showHelp = ref(false)
  const dragAssetId = ref<string | null>(null)

  const numberLimits: Record<SpriteNumberKey, { min: number; max?: number }> = {
    interval: { min: 5 },
    width: { min: 10, max: 7680 },
    height: { min: 10, max: 4320 },
    columns: { min: 1, max: 500 },
    rows: { min: 1, max: 500 },
    count_frame: { min: 1, max: 30000 },
  }

  const form = ref<{
    name: string
    interval: number | null
    width: number | null
    height: number | null
    columns: number | null
    rows: number | null
    count_frame: number | null
  }>({
    name: '',
    interval: 10,
    width: 160,
    height: 90,
    columns: 10,
    rows: 10,
    count_frame: null,
  })

  const assetDrafts = ref<SpriteAssetDraft[]>([])
  const pendingAssetCount = computed(() => assetDrafts.value.filter((asset) => !asset.assetId).length)
  const uploadedAssetCount = computed(() => assetDrafts.value.length - pendingAssetCount.value)
  const allAssetsUploaded = computed(() => assetDrafts.value.length > 0 && pendingAssetCount.value === 0)

  function parseIntegerDraft(value: string | number | null) {
    if (value === null || value === '') return null

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null

    return Math.round(parsed)
  }

  function clampInteger(value: number | null, min: number, max = Number.MAX_SAFE_INTEGER) {
    if (value === null) return null
    return Math.min(max, Math.max(min, Math.round(value)))
  }

  function updateNameFromFrameSize() {
    if (form.value.width === null || form.value.height === null) return
    form.value.name = `预览图_${form.value.width}x${form.value.height}`
  }

  function setNumberField(key: SpriteNumberKey, value: string | number | null) {
    form.value[key] = parseIntegerDraft(value)
    if (key === 'width' || key === 'height') updateNameFromFrameSize()
  }

  function normalizeNumberField(key: SpriteNumberKey) {
    const limit = numberLimits[key]
    form.value[key] = clampInteger(form.value[key], limit.min, limit.max)
    if (key === 'width' || key === 'height') updateNameFromFrameSize()
  }

  function requirePositiveInteger(value: number | null, label: string, min: number, max?: number) {
    const isInvalid = value === null || !Number.isInteger(value) || value < min || (max !== undefined && value > max)

    if (isInvalid) {
      toast.push(max === undefined ? `${label}必须是正整数` : `${label}必须是 ${min} 到 ${max} 的正整数`, 'error')
      return null
    }

    return value
  }

  function onFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const files = Array.from(target.files ?? [])
    if (files.length === 0) return

    assetDrafts.value = [
      ...assetDrafts.value,
      ...files.map((file) => ({
        localId: `asset_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        assetId: null,
        uploading: false,
      })),
    ]

    target.value = ''
  }

  function removeAssetDraft(localId: string) {
    const target = assetDrafts.value.find((asset) => asset.localId === localId)
    if (target) URL.revokeObjectURL(target.previewUrl)
    assetDrafts.value = assetDrafts.value.filter((asset) => asset.localId !== localId)
  }

  function clearAssetDrafts() {
    assetDrafts.value.forEach((asset) => URL.revokeObjectURL(asset.previewUrl))
    assetDrafts.value = []
  }

  async function uploadAsset() {
    const pendingAssets = assetDrafts.value.filter((asset) => !asset.assetId)
    if (pendingAssets.length === 0 || uploading.value) return
    uploading.value = true

    try {
      await Promise.all(
        pendingAssets.map(async (asset) => {
          asset.uploading = true
          try {
            const response = await uploadPlaybackAsset(props.versionId, asset.file)
            asset.assetId = response.asset_id
          } finally {
            asset.uploading = false
          }
        }),
      )
      toast.push(`已上传 ${pendingAssets.length} 张 雪碧图`, 'success')
    } finally {
      uploading.value = false
    }
  }

  function startAssetDrag(asset: SpriteAssetDraft) {
    dragAssetId.value = asset.localId
  }

  function stopAssetDrag() {
    dragAssetId.value = null
  }

  function dropAsset(targetId: string) {
    const sourceId = dragAssetId.value
    if (!sourceId || sourceId === targetId) return

    const sourceIndex = assetDrafts.value.findIndex((asset) => asset.localId === sourceId)
    const targetIndex = assetDrafts.value.findIndex((asset) => asset.localId === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const next = [...assetDrafts.value]
    const [source] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, source)
    assetDrafts.value = next
    dragAssetId.value = null
  }

  async function submitSprite() {
    const uploadedAssetIds = assetDrafts.value.map((asset) => asset.assetId).filter((assetId): assetId is number => assetId !== null)

    if (creating.value || uploadedAssetIds.length === 0) {
      if (uploadedAssetIds.length === 0) toast.push('请先上传雪碧图', 'error')
      return
    }

    if (uploadedAssetIds.length !== assetDrafts.value.length) {
      toast.push('请先上传全部雪碧图', 'error')
      return
    }

    const interval = requirePositiveInteger(form.value.interval, '间隔秒', 5)
    const width = requirePositiveInteger(form.value.width, '单帧宽度', 10, 7680)
    const height = requirePositiveInteger(form.value.height, '单帧高度', 10, 4320)
    const columns = requirePositiveInteger(form.value.columns, '雪碧图列数', 1, 500)
    const rows = requirePositiveInteger(form.value.rows, '雪碧图行数', 1, 500)
    const countFrame = requirePositiveInteger(form.value.count_frame, '雪碧图总帧数', 1, 30000)
    const name = form.value.name.trim()

    if ([interval, width, height, columns, rows, countFrame].some((value) => value === null)) return
    if (!name) {
      toast.push('名称必填', 'error')
      return
    }

    creating.value = true

    try {
      await createSprite(props.versionId, {
        name,
        interval,
        width,
        height,
        columns,
        rows,
        count_frame: countFrame,
        assets_ids: uploadedAssetIds,
      })
      toast.push('时间轴预览图已保存', 'success')
      clearAssetDrafts()
      form.value.name = '默认'
      emit('created')
    } finally {
      creating.value = false
    }
  }

  onBeforeUnmount(clearAssetDrafts)
</script>

<template>
  <div class="panel p-5">
    <div class="flex items-start justify-between gap-3">
      <h3 class="font-semibold text-ink">新增预览图</h3>
      <Tooltip text="上传须知">
        <button type="button" class="icon-btn" aria-label="上传须知" @click="showHelp = true">
          <CircleHelp :size="17" />
        </button>
      </Tooltip>
    </div>
    <div class="mt-4 grid gap-3 md:grid-cols-3">
      <ClearableInput
        :model-value="form.width"
        label="单帧宽度"
        type="number"
        :min="10"
        :max="7680"
        :step="1"
        @update:model-value="setNumberField('width', $event)"
        @blur="normalizeNumberField('width')"
      />
      <ClearableInput
        :model-value="form.height"
        label="单帧高度"
        type="number"
        :min="10"
        :max="4320"
        :step="1"
        @update:model-value="setNumberField('height', $event)"
        @blur="normalizeNumberField('height')"
      />
      <ClearableInput v-model="form.name" label="名称" placeholder="默认" />
      <ClearableInput
        :model-value="form.interval"
        label="帧间隔秒"
        type="number"
        :min="5"
        :step="1"
        @update:model-value="setNumberField('interval', $event)"
        @blur="normalizeNumberField('interval')"
      />
      <div class="grid grid-cols-2 gap-3 md:col-span-1">
        <ClearableInput
          :model-value="form.rows"
          label="单张雪碧图行数"
          type="number"
          :min="1"
          :max="500"
          :step="1"
          @update:model-value="setNumberField('rows', $event)"
          @blur="normalizeNumberField('rows')"
        />
        <ClearableInput
          :model-value="form.columns"
          label="单张雪碧图列数"
          type="number"
          :min="1"
          :max="500"
          :step="1"
          @update:model-value="setNumberField('columns', $event)"
          @blur="normalizeNumberField('columns')"
        />
      </div>
      <ClearableInput
        :model-value="form.count_frame"
        label="雪碧图总帧数"
        type="number"
        :min="1"
        :max="30000"
        :step="1"
        @update:model-value="setNumberField('count_frame', $event)"
        @blur="normalizeNumberField('count_frame')"
      />
    </div>

    <SpriteAssetDraftList
      :assets="assetDrafts"
      :pending-count="pendingAssetCount"
      :uploaded-count="uploadedAssetCount"
      :uploading="uploading"
      :drag-asset-id="dragAssetId"
      @file-change="onFileChange"
      @clear="clearAssetDrafts"
      @upload="uploadAsset"
      @remove="removeAssetDraft"
      @drag-start="startAssetDrag"
      @drag-end="stopAssetDrag"
      @drop="dropAsset"
    />

    <div class="mt-5 flex justify-end">
      <button type="button" class="btn-primary" :disabled="creating || !allAssetsUploaded" @click="submitSprite">
        <Loader2 v-if="creating" :size="17" class="animate-spin" />
        <Plus v-else :size="17" />
        保存预览图
      </button>
    </div>
  </div>

  <SpriteHelpDialog :open="showHelp" @close="showHelp = false" />
</template>
