import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { godMode } from '@/engine/cheats'
import type { Actor } from '@/engine/types'

type Scope = {
  $gameParty: { allMembers(): Actor[] }
  $gameActors?: { actor(id: number): Actor | null }
  __resetGame(): void
}

const scope = () => globalThis as unknown as Scope
const members = () => scope().$gameParty.allMembers()

/** 読み込み後の状態を真似る。同じ ID でも別のオブジェクトになる。 */
function loadSave(): void {
  const fresh = new Map(members().map((actor) => [actor._actorId, { ...actor } as Actor]))
  scope().$gameActors = { actor: (id) => fresh.get(id) ?? null }
}

beforeEach(() => {
  vi.useFakeTimers()
  scope().__resetGame()
  scope().$gameActors = { actor: (id) => members().find((actor) => actor._actorId === id) ?? null }
})

afterEach(() => {
  for (const actor of members()) if (godMode.isOn(actor)) godMode.toggle(actor)
  delete scope().$gameActors
  vi.useRealTimers()
})

describe('god mode', () => {
  it('keeps healing an actor that is still in the game', () => {
    const [actor] = members()
    godMode.toggle(actor!)

    vi.advanceTimersByTime(1000)

    // 回復メソッドは神モードが差し替えるので、見るのは「手放していない」こと
    expect(godMode.isOn(actor!)).toBe(true)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('lets go of an actor a save load replaced, as the screen already shows it off', () => {
    const [actor] = members()
    godMode.toggle(actor!)

    loadSave()
    vi.advanceTimersByTime(1000)

    expect(godMode.isOn(actor!)).toBe(false)
  })

  it('stops the timer once nothing is left to keep alive', () => {
    const [actor] = members()
    godMode.toggle(actor!)

    loadSave()
    vi.advanceTimersByTime(1000)

    expect(vi.getTimerCount()).toBe(0)
  })
})
