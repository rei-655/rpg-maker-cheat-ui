import { ref, shallowRef } from 'vue'

export interface ConfirmRequest {
  title?: string
  message: string
  confirmText?: string
  danger?: boolean
}

const request = ref<ConfirmRequest | null>(null)
const resolver = shallowRef<((value: boolean) => void) | null>(null)

export function confirm(options: ConfirmRequest): Promise<boolean> {
  answer(false)

  return new Promise<boolean>((resolve) => {
    request.value = options
    resolver.value = resolve
  })
}

function answer(value: boolean): void {
  const resolve = resolver.value

  request.value = null
  resolver.value = null
  resolve?.(value)
}

export function useConfirm() {
  return { request, answer }
}
