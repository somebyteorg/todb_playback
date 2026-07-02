import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const useSignStore = defineStore(
  'sign',
  () => {
    const api_key = ref('')
    const is_dark = ref(false)

    const isSignedIn = computed(() => Boolean(api_key.value))

    function setToken(token: string) {
      api_key.value = token
    }

    async function signOut() {
      api_key.value = ''
    }

    function setDarkMode(value: boolean) {
      is_dark.value = value
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = value ? 'dark' : 'light'
      }
    }

    return {
      api_key,
      is_dark,
      isSignedIn,
      setToken,
      setDarkMode,
      signOut,
    }
  },
  {
    persist: true,
  },
)

export default useSignStore
