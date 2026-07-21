import { HTTPError } from 'ky'
import request from '@/utils/ky'
import { useToastStore } from '@/stores/toast'

type SearchValue = string | number | boolean | null | undefined

export function cleanSearchParams(params: Record<string, SearchValue>) {
  const cleaned: Record<string, string> = {}

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    cleaned[key] = String(value)
  })

  return cleaned
}

async function errorMessage(error: unknown, silentStatuses: number[] = []) {
  if (error instanceof Error && error.name === 'AbortError') {
    return null
  }

  if (error instanceof HTTPError) {
    if (silentStatuses.includes(error.response.status)) {
      return null
    }

    if (error.response.status === 422) {
      const body = (await error.response
        .clone()
        .json()
        .catch(() => null)) as { message?: string } | null
      return body?.message || '请求参数无效'
    }

    if (error.response.status >= 500) return '服务器暂时不可用'
    if (error.response.status === 403) return '没有权限执行此操作'
    if (error.response.status === 404) return '没有找到对应数据'
  }

  return error instanceof Error ? error.message : '请求失败'
}

export async function apiJson<T>(path: string, options: Parameters<typeof request.get>[1] = {}, silentStatuses: number[] = []) {
  try {
    return await request.get(path, options).json<T>()
  } catch (error) {
    const message = await errorMessage(error, silentStatuses)
    if (message) {
      useToastStore().push(message, 'error')
    }
    throw error
  }
}

export async function apiPostJson<T>(path: string, json?: unknown) {
  try {
    return await request.post(path, { json }).json<T>()
  } catch (error) {
    const message = await errorMessage(error)
    if (message) {
      useToastStore().push(message, 'error')
    }
    throw error
  }
}

export async function apiPostVoid(path: string, json?: unknown) {
  try {
    await request.post(path, { json })
  } catch (error) {
    const message = await errorMessage(error)
    if (message) {
      useToastStore().push(message, 'error')
    }
    throw error
  }
}

export async function apiPutVoid(path: string, json?: unknown) {
  try {
    await request.put(path, { json })
  } catch (error) {
    const message = await errorMessage(error)
    if (message) {
      useToastStore().push(message, 'error')
    }
    throw error
  }
}

export async function apiDeleteVoid(path: string, searchParams?: Record<string, string>) {
  try {
    await request.delete(path, { searchParams })
  } catch (error) {
    const message = await errorMessage(error)
    if (message) {
      useToastStore().push(message, 'error')
    }
    throw error
  }
}

export async function apiUpload<T>(path: string, body: FormData) {
  try {
    return await request.post(path, { body }).json<T>()
  } catch (error) {
    const message = await errorMessage(error)
    if (message) {
      useToastStore().push(message, 'error')
    }
    throw error
  }
}

export const ToSign = () => {
  window.location.href = 'https://theotherdb.org/api/sign?state=playback'
}
