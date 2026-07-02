import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: number
  type: ToastType
  message: string
}

let toastId = 1

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastMessage[]>([])

  function push(message: string, type: ToastType = 'info') {
    const id = toastId++
    items.value.push({ id, type, message })

    window.setTimeout(() => remove(id), 5000)
  }

  function remove(id: number) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  return {
    items,
    push,
    remove,
  }
})
