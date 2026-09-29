import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { databaseEntries, heldCount, heldMax, isIndependent, setHeld } from '@/engine/inventory'
import type { DataItem } from '@/engine/types'

type Scope = Record<string, unknown> & { __resetGame(): void }

const scope = () => globalThis as unknown as Scope
const sword: DataItem = { id: 1, name: 'Sword' }

let saved: Record<string, unknown> = {}

function keep(...names: string[]): void {
  for (const name of names) saved[name] = scope()[name]
}

beforeEach(() => {
  scope().__resetGame()
  saved = {}
  keep('$gameParty', 'DataManager')
})

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) scope()[name] = value
})

/** YEP_ItemCore の独立アイテム。1 本ずつ別の複製として持ち、上限は種類全体で共有する。 */
function independentGame(typeMax: number, owned: number): { copies: DataItem[] } {
  const copies: DataItem[] = []

  for (let i = 0; i < owned; i += 1) copies.push({ id: 100 + i, name: 'Sword', baseItemId: sword.id })

  scope().DataManager = { isIndependent: (item: DataItem) => !item.baseItemId }
  scope().$gameParty = {
    numItems: () => true,
    maxItems: () => 1,
    numIndependentItems: (item: DataItem) => copies.filter((copy) => copy.baseItemId === item.id).length,
    getIndependentItemTypeMax: () => typeMax,
    getIndependentItemTypeCur: () => copies.length,
    gainItem: (item: DataItem, amount: number) => {
      // 実物のゲームと同じく、上限を確かめずに作る
      if (amount > 0) for (let i = 0; i < amount; i += 1) copies.push({ id: 200 + i, name: 'Sword', baseItemId: item.id })
      if (amount < 0) copies.splice(0, Math.abs(amount))
    }
  }

  return { copies }
}

describe('a plain game', () => {
  it('uses the engine count as it is', () => {
    scope().$gameParty = { numItems: () => 7, maxItems: () => 99, gainItem: () => {} }

    expect(heldCount(sword)).toBe(7)
    expect(heldMax(sword)).toBe(99)
  })

  it('does not treat items as independent when the game has no such system', () => {
    scope().DataManager = {}

    expect(isIndependent(sword)).toBe(false)
  })
})

describe('a game whose engine was edited to answer true', () => {
  // 実例: 装備品に対して numItems が true を返すよう rpg_objects.js を書き換えたゲーム
  it('reads the container instead of showing true', () => {
    scope().$gameParty = {
      numItems: () => true,
      maxItems: () => 99,
      itemContainer: () => ({ 1: 3 }),
      gainItem: () => {}
    }

    expect(heldCount(sword)).toBe(3)
  })

  it('reads 0 rather than 1 when the container has nothing', () => {
    scope().$gameParty = { numItems: () => true, maxItems: () => 99, itemContainer: () => ({}), gainItem: () => {} }

    expect(heldCount(sword)).toBe(0)
  })
})

describe('a game that keeps each weapon as its own copy', () => {
  it('counts the copies of this weapon', () => {
    independentGame(20, 3)

    expect(heldCount(sword)).toBe(3)
  })

  it('offers the shared free room plus what is already held, not 1', () => {
    independentGame(20, 3)

    expect(heldMax(sword)).toBe(20)
  })

  it('never makes more copies than the shared limit allows', () => {
    const { copies } = independentGame(5, 3)

    setHeld(sword, 999)

    expect(copies).toHaveLength(5)
  })

  it('removes copies when the number goes down', () => {
    const { copies } = independentGame(20, 4)

    expect(setHeld(sword, 1)).toBe(1)
    expect(copies).toHaveLength(1)
  })

  it('leaves the copies out of the list, so rows do not multiply', () => {
    independentGame(20, 2)

    const list = databaseEntries([null, sword, { id: 100, name: 'Sword', baseItemId: 1 }])

    expect(list.map((item) => item.id)).toEqual([1])
  })
})
