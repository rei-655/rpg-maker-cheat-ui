import { ref } from 'vue'
import { settings } from '@/engine/storage'
import en from './en'
import ja from './ja'
import ko from './ko'
import type { Locale, MessageKey, Messages } from './types'

export type { Locale, MessageKey }

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' }
]

const CATALOGUES: Record<Locale, Messages> = { en, ja, ko }
const STORAGE_KEY = 'locale'

/** プラグインの defaultLocale。auto または未指定ならブラウザの言語を見る。 */
declare global {
  interface Window {
    __CHEAT_UI_LOCALE__?: string
  }
}

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ja' || value === 'ko'
}

function detect(): Locale {
  const tag = (globalThis.navigator?.language ?? 'en').toLowerCase()

  if (tag.startsWith('ja')) return 'ja'
  if (tag.startsWith('ko')) return 'ko'
  return 'en'
}

/** 保存された選択 > プラグインの既定値 > 表示言語の順で決める。 */
function initial(): Locale {
  const saved = settings.get<string>(STORAGE_KEY, '')
  if (isLocale(saved)) return saved

  const fromPlugin = globalThis.window?.__CHEAT_UI_LOCALE__
  if (isLocale(fromPlugin)) return fromPlugin

  return detect()
}

const current = ref<Locale>(initial())

export const locale = current

export function setLocale(next: Locale): void {
  current.value = next
  settings.set(STORAGE_KEY, next)
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const text = CATALOGUES[current.value][key] ?? en[key] ?? key

  if (!params) return text

  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  )
}
