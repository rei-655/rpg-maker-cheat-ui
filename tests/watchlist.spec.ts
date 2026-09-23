import { beforeEach, describe, expect, it } from 'vitest'
import { probe } from '@/engine/probe'
import { settingsFile } from '@/engine/engine'
import {
  add,
  load,
  readWatch,
  refOf,
  remove,
  rename,
  resolveAll,
  saved,
  writeWatch,
  type Target,
  type Watch
} from '@/features/data/watchlist'

const game = () =>
  globalThis as unknown as {
    LifeSim: { modules: { Stats: { _data: Record<string, number> } } }
    $gameVariables: { value(id: number): unknown; setValue(id: number, value: unknown): void }
    $gameSwitches: { value(id: number): boolean }
    __resetGame(): void
  }

const stamina = (): Target => {
  const found = probe().find((entry) => entry.path === 'LifeSim.modules.Stats._data.stamina')!
  return { kind: 'path', keys: found.keys, name: found.key }
}

const variable = (id: number, name = 'Gold Counter'): Target => ({ kind: 'variable', id, name })
const stored = () => JSON.parse(localStorage.getItem(settingsFile('watchlist.json')) ?? '{}')

beforeEach(() => game().__resetGame())

describe('watchlist', () => {
  it('keeps a value that took work to find', () => {
    const entries = add([], stamina())

    expect(entries).toHaveLength(1)
    expect(entries[0].ref).toBe('LifeSim.modules.Stats._data.stamina')
    expect(entries[0].name).toBe('stamina')
  })

  it('survives a restart, because the list is written next to the game', () => {
    add([], stamina())

    expect(load().map((entry) => entry.ref)).toEqual(['LifeSim.modules.Stats._data.stamina'])
  })

  it('refuses to save the same place twice', () => {
    expect(add(add([], stamina()), stamina())).toHaveLength(1)
  })

  it('takes a name of your own, since a bare key says little', () => {
    const entries = rename(add([], stamina()), load()[0]!.key, '体力')

    expect(entries[0].name).toBe('体力')
    expect(load()[0]!.name).toBe('体力')
  })

  it('keeps the old name when the new one is blank', () => {
    expect(rename(add([], stamina()), load()[0]!.key, '   ')[0].name).toBe('stamina')
  })

  it('forgets an entry on request', () => {
    const entries = add([], stamina())

    expect(remove(entries, entries[0].key)).toHaveLength(0)
    expect(load()).toHaveLength(0)
  })

  it('reads the live value back, not the one from when it was saved', () => {
    const entries = add([], stamina())
    game().LifeSim.modules.Stats._data.stamina = 90

    expect(resolveAll(entries)[0].field.value).toBe(90)
  })

  it('marks an entry whose object is not there right now instead of dropping it', () => {
    const entries = add([], { kind: 'path', keys: ['Gone', 'deep', 'value'], name: 'value' })

    expect(resolveAll(entries)[0].found).toBe(false)
    expect(load()).toHaveLength(1)
  })

  it('answers whether a place is already kept', () => {
    const entries = add([], stamina())

    expect(saved(entries, 'LifeSim.modules.Stats._data.stamina')).toBe(true)
    expect(saved(entries, 'LifeSim.modules.Stats._data.kaihenPt')).toBe(false)
  })
})

describe('watchlist holds variables and switches too', () => {
  // 利用者にとって「よく触る値」は一つの束で、変数かプラグインの中かは関心の外。
  it('saves a variable by id', () => {
    const [entry] = add([], variable(1))

    expect(entry!.kind).toBe('variable')
    expect(entry!.ref).toBe('var:1')
    expect(entry!.id).toBe(1)
  })

  it('saves a switch under a separate identity, so ids do not collide', () => {
    const entries = add(add([], variable(1)), { kind: 'switch', id: 1, name: 'Opening Done' })

    expect(entries.map((entry) => entry.ref)).toEqual(['var:1', 'sw:1'])
  })

  it('reads a variable through the engine, not by poking its array', () => {
    game().$gameVariables.setValue(1, 777)

    expect(readWatch(add([], variable(1))[0]!)).toBe(777)
  })

  it('writes a variable through setValue and keeps the number type', () => {
    const entry = add([], variable(1))[0]!

    expect(writeWatch(entry, '512')).toBe(true)
    expect(game().$gameVariables.value(1)).toBe(512)
    expect(typeof game().$gameVariables.value(1)).toBe('number')
  })

  it('writes a switch as a boolean, not the string "true"', () => {
    const entry = add([], { kind: 'switch', id: 2, name: 'Secret Found' })[0]!

    expect(writeWatch(entry, 'true')).toBe(true)
    expect(game().$gameSwitches.value(2)).toBe(true)
  })

  it('builds the same identity for a target and the entry it became', () => {
    expect(refOf(add([], variable(3))[0]!)).toBe(refOf(variable(3)))
  })

  it('reports a switch as a boolean field so the row can show a toggle', () => {
    const entries: Watch[] = add([], { kind: 'switch', id: 1, name: 'Opening Done' })

    expect(resolveAll(entries)[0].field.kind).toBe('boolean')
  })
})

describe('watchlist migration', () => {
  it('reads the 2.2 format, which had no kind and stored a path', () => {
    localStorage.setItem(
      settingsFile('watchlist.json'),
      JSON.stringify({
        saved: [
          {
            key: 'w1',
            name: '体力',
            path: 'LifeSim.modules.Stats._data.stamina',
            keys: ['LifeSim', 'modules', 'Stats', '_data', 'stamina']
          }
        ]
      })
    )

    const [entry] = load()

    expect(entry!.kind).toBe('path')
    expect(entry!.ref).toBe('LifeSim.modules.Stats._data.stamina')
    expect(readWatch(entry!)).toBe(45)
  })

  it('ignores entries an older build left broken', () => {
    localStorage.setItem(
      settingsFile('watchlist.json'),
      JSON.stringify({ saved: [{ name: 'no keys' }, null, { kind: 'variable', name: 'no id' }] })
    )

    expect(load()).toHaveLength(0)
  })

  it('writes back in the current shape once anything changes', () => {
    add([], variable(1))

    expect(stored().saved[0]).toMatchObject({ kind: 'variable', ref: 'var:1', id: 1 })
  })
})
