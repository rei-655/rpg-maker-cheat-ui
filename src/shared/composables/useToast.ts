import { readonly, ref } from 'vue'

export type ToastLevel = 'success' | 'info' | 'warn' | 'error'

export interface Toast {
  id: number
  level: ToastLevel
  text: string
}

const MAX_VISIBLE = 4
const TIMEOUT = 2400

const items = ref<Toast[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()

let nextId = 1

function push(level: ToastLevel, message: string, cause?: unknown): void {
  const id = nextId++
  const text = cause ? `${message}\n${String(cause)}` : message

  items.value = [...items.value, { id, level, text }].slice(-MAX_VISIBLE)
  timers.set(
    id,
    setTimeout(() => dismiss(id), TIMEOUT)
  )
}

function dismiss(id: number): void {
  const timer = timers.get(id)
  if (timer) clearTimeout(timer)

  timers.delete(id)
  items.value = items.value.filter((item) => item.id !== id)
}

export const toast = {
  success: (message: string, cause?: unknown) => push('success', message, cause),
  info: (message: string, cause?: unknown) => push('info', message, cause),
  warn: (message: string, cause?: unknown) => push('warn', message, cause),
  error: (message: string, cause?: unknown) => push('error', message, cause)
}

export function useToasts() {
  return { toasts: readonly(items), dismiss }
}
