<script setup lang="ts">
  import { computed } from 'vue'
  import ClearableSelect from '@/components/ClearableSelect.vue'
  import { formatDate, formatDuration } from '@/utils/format'
  import type { ExternalSpiderEpisode } from '@/types/api'
  import type { SelectOption } from '@/components/ClearableSelect.vue'

  interface AssignedEpisode {
    episode_id: number
    episode_number: number
  }

  const props = withDefaults(
    defineProps<{
      modelValue: string | null
      externalEpisodes: ExternalSpiderEpisode[]
      currentEpisodeId: number
      assignedEpisodesByValue: Record<string, AssignedEpisode>
      missingValue?: string
      disabled?: boolean
      limit?: number
    }>(),
    {
      missingValue: '',
      limit: 60,
    },
  )

  const emit = defineEmits<{
    'update:modelValue': [value: string | null]
  }>()

  const options = computed<SelectOption[]>(() => {
    const result: SelectOption[] = [{ value: '', label: '不关联', searchText: '' }]

    props.externalEpisodes.forEach((episode) => {
      result.push({
        value: episode.external_value,
        label: optionLabel(episode),
        description: optionDescription(episode),
        searchText: optionSearchText(episode),
      })
    })

    if (props.missingValue && !props.externalEpisodes.some((episode) => episode.external_value === props.missingValue)) {
      result.splice(1, 0, {
        value: props.missingValue,
        label: `保留当前值: ${props.missingValue}`,
        searchText: '',
      })
    }

    return result
  })

  function runtimeText(runtime: number | null | undefined) {
    if (!runtime) return ''

    return formatDuration(runtime < 600 ? runtime * 60 : runtime)
  }

  function metaText(episode: ExternalSpiderEpisode) {
    return [formatDate(episode.date_air), runtimeText(episode.runtime)].filter(Boolean).join(' / ')
  }

  function optionLabel(episode: ExternalSpiderEpisode) {
    return [formatDate(episode.date_air) || '无日期', runtimeText(episode.runtime) || '未知时长', `第 ${episode.episode_number} 集`].join(' · ')
  }

  function optionDescription(episode: ExternalSpiderEpisode) {
    const assignedEpisode = props.assignedEpisodesByValue[episode.external_value]
    const title = episode.episode_title || '未命名'

    if (!assignedEpisode || assignedEpisode.episode_id === props.currentEpisodeId) return title

    return `${title}（已选: 本地第 ${assignedEpisode.episode_number} 集）`
  }

  function optionSearchText(episode: ExternalSpiderEpisode) {
    const episodeNumber = String(episode.episode_number)

    return [episodeNumber, episode.episode_title ?? ''].filter(Boolean).join(' ')
  }

  function updateValue(value: string | number | null) {
    emit('update:modelValue', value ? String(value) : null)
  }
</script>

<template>
  <ClearableSelect
    :model-value="modelValue ?? ''"
    :options="options"
    :disabled="disabled"
    :clearable="false"
    searchable
    search-placeholder="搜索集数或标题"
    :max-visible-options="limit"
    empty-text="没有匹配到外部剧集"
    teleport-dropdown
    @update:model-value="updateValue"
  />
</template>
