export type Refinement = 'changed' | 'unchanged' | 'increased' | 'decreased' | 'equals'

export const REFINEMENTS: { key: Refinement; operand?: true }[] = [
  { key: 'changed' },
  { key: 'unchanged' },
  { key: 'increased' },
  { key: 'decreased' },
  { key: 'equals', operand: true }
]

/**
 * メモリスキャナ方式の絞り込み。全値を記録し、ゲームを動かしてから
 * 期待どおり変化したものだけ残す。保持するのは鍵だけ。
 *
 * 鍵は変数 ID でもオブジェクトのパスでもよい。
 */
export class ValueScan<K = number> {
  private candidates = new Set<K>()
  private previous = new Map<K, unknown>()

  active = false
  passes = 0

  constructor(private readonly read: (key: K) => unknown) {}

  get count(): number {
    return this.candidates.size
  }

  has(key: K): boolean {
    return this.candidates.has(key)
  }

  start(keys: Iterable<K>): void {
    this.active = true
    this.passes = 0
    this.candidates = new Set(keys)
    this.snapshot()
  }

  reset(): void {
    this.active = false
    this.passes = 0
    this.candidates = new Set()
    this.previous = new Map()
  }

  refine(kind: Refinement, operand: number | null = null): number {
    if (!this.active) return 0

    const kept = new Set<K>()

    for (const key of this.candidates) {
      if (this.test(kind, key, operand)) kept.add(key)
    }

    this.candidates = kept
    this.passes += 1
    this.snapshot()

    return kept.size
  }

  private test(kind: Refinement, key: K, operand: number | null): boolean {
    const before = this.previous.get(key)
    const after = this.read(key)

    switch (kind) {
      case 'changed':
        return after !== before
      case 'unchanged':
        return after === before
      case 'increased':
        return numeric(after) && numeric(before) && Number(after) > Number(before)
      case 'decreased':
        return numeric(after) && numeric(before) && Number(after) < Number(before)
      case 'equals':
        return numeric(after) && Number(after) === Number(operand)
    }
  }

  private snapshot(): void {
    this.previous = new Map()
    for (const key of this.candidates) this.previous.set(key, this.read(key))
  }
}

function numeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
}
