<script setup lang="ts">
  import { computed } from 'vue'
  import { X } from '@lucide/vue'
  import Tooltip from '@/components/Tooltip.vue'

  const props = withDefaults(
    defineProps<{
      modelValue: string | number | null | undefined
      label?: string
      type?: string
      placeholder?: string
      textarea?: boolean
      rows?: number
      maxlength?: number | string
      min?: number | string
      max?: number | string
      step?: number | string
      disabled?: boolean
      clearable?: boolean
    }>(),
    {
      type: 'text',
      placeholder: '',
      rows: 3,
      clearable: true,
    },
  )

  const emit = defineEmits<{
    'update:modelValue': [value: string | number | null]
    blur: [event: FocusEvent]
    clear: []
  }>()

  const value = computed({
    get: () => props.modelValue ?? '',
    set: (next: string | number) => {
      if (props.type === 'number') {
        emit('update:modelValue', next === '' ? null : Number(next))
        return
      }

      emit('update:modelValue', String(next))
    },
  })

  function clear() {
    emit('update:modelValue', props.type === 'number' ? null : '')
    emit('clear')
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement
    value.value = target.value
  }

  function handleBlur(event: FocusEvent) {
    emit('blur', event)
  }
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1.5 block text-sm font-medium text-ink/75">{{ label }}</span>
    <span class="relative block">
      <textarea v-if="textarea" :value="value" :rows="rows" :placeholder="placeholder" :disabled="disabled" :maxlength="maxlength" class="field min-h-24 resize-y pr-11" @input="handleInput" />
      <input
        v-else
        :value="value"
        :type="type"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        class="field pr-11"
        @input="handleInput"
        @blur="handleBlur"
      />
      <Tooltip v-if="clearable && value !== '' && !disabled" text="清空">
        <button
          type="button"
          class="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink/45 transition hover:bg-ink/10 hover:text-ink"
          aria-label="清空"
          @click="clear"
        >
          <X :size="15" />
        </button>
      </Tooltip>
    </span>
  </label>
</template>
