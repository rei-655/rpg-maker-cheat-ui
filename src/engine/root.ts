/**
 * グローバルオブジェクト。
 *
 * `globalThis` は Chromium 71 から。ツクール MV 1.6 が同梱する NW.js 0.29 は
 * Chromium 66 なので、そのまま書くと読み込んだ瞬間に落ちる。
 */
export const root: Record<string, unknown> =
  (typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : self) as unknown as Record<string, unknown>

export function global<T>(name: string): T {
  return root[name] as T
}

export function hasGlobal(name: string): boolean {
  return root[name] != null
}
