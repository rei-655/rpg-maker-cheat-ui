import type en from './en'

export type Locale = 'en' | 'ja' | 'ko'

/** en を原本とし、他の言語はキーの欠落を型で弾く。 */
export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, string>
