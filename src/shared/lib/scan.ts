export type Refinement = 'changed' | 'unchanged' | 'increased' | 'decreased' | 'equals'

export const REFINEMENTS: { key: Refinement; label: string; operand?: true }[] = [
  { key: 'changed', label: '변함' },
  { key: 'unchanged', label: '그대로' },
  { key: 'increased', label: '증가' },
  { key: 'decreased', label: '감소' },
  { key: 'equals', label: '= 값', operand: true }
]

/**
 * メモリスキャナ方式の絞り込み。全値を記録し、ゲームを動かしてから
 * 期待どおり変化したものだけ残す。保持するのは id だけ。
 */
export class ValueScan {
  private candidates = new Set<number>()
  private previous = new Map<number, unknown>()

  active = false
  passes = 0

  constructor(private readonly read: (id: number) => unknown) {}

  get count(): number {
    return this.candidates.size
  }

  has(id: number): boolean {
    return this.candidates.has(id)
  }

  start(ids: Iterable<number>): void {
    this.active = true
    this.passes = 0
    this.candidates = new Set(ids)
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

    const kept = new Set<number>()

    for (const id of this.candidates) {
      if (this.test(kind, id, operand)) kept.add(id)
    }

    this.candidates = kept
    this.passes += 1
    this.snapshot()

    return kept.size
  }

  private test(kind: Refinement, id: number, operand: number | null): boolean {
    const before = this.previous.get(id)
    const after = this.read(id)

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
    for (const id of this.candidates) this.previous.set(id, this.read(id))
  }
}

function numeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
}
