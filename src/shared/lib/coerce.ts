/**
 * 入力欄は文字列を返す。数値 10 の変数に "10" を書くと型が変わり
 * イベント条件が壊れるため、元の型を保つ。
 */
export function coerceLike(raw: unknown, original: unknown): unknown {
  if (typeof original === 'number') {
    const value = Number(raw)
    return Number.isFinite(value) ? value : original
  }

  if (typeof original === 'boolean') {
    if (typeof raw === 'boolean') return raw
    const word = String(raw).trim().toLowerCase()
    return word === 'true' || word === '1' || word === 'on'
  }

  if (original === null || original === undefined || original === '') {
    const value = Number(raw)
    if (String(raw).trim() !== '' && Number.isFinite(value)) return value
  }

  return raw
}

export function toInt(raw: unknown, fallback: number | null = null): number | null {
  const value = Number(raw)

  if (String(raw).trim() === '' || !Number.isFinite(value)) return fallback

  return Math.trunc(value)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
