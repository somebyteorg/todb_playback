import { defineStore } from 'pinia'
import { ref } from 'vue'

interface ConfirmState {
  title: string
  message: string
  danger: boolean
  resolve: (value: boolean) => void
}

export const useConfirmStore = defineStore('confirm', () => {
  const current = ref<ConfirmState | null>(null)

  function ask(options: { title?: string; message: string; danger?: boolean }) {
    return new Promise<boolean>((resolve) => {
      current.value = {
        title: options.title ?? '确认操作',
        message: options.message,
        danger: Boolean(options.danger),
        resolve,
      }
    })
  }

  function answer(value: boolean) {
    if (!current.value) return
    current.value.resolve(value)
    current.value = null
  }

  return {
    current,
    ask,
    answer,
  }
})
