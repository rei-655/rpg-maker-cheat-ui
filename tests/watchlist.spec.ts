import { beforeEach, describe, expect, it } from 'vitest'
import { probe } from '@/engine/probe'
import { settingsFile } from '@/engine/engine'
import { add, load, remove, rename, resolveAll, saved } from '@/features/data/watchlist'

const game = () =>
  globalThis as unknown as {
    LifeSim: { modules: { Stats: { _data: Record<string, number> } } }
    __resetGame(): void
  }

const stamina = () => probe().find((entry) => entry.path === 'LifeSim.modules.Stats._data.stamina')!

beforeEach(() => game().__resetGame())

describe('watchlist', () => {
  it('keeps a value that took work to find', () => {
    const entries = add([], stamina())

    expect(entries).toHaveLength(1)
    expect(entries[0].path).toBe('LifeSim.modules.Stats._data.stamina')
    expect(entries[0].name).toBe('stamina')
  })

  it('survives a restart, because the list is written next to the game', () => {
    add([], stamina())

    expect(load().map((entry) => entry.path)).toEqual(['LifeSim.modules.Stats._data.stamina'])
  })

  it('refuses to save the same place twice', () => {
    const once = add([], stamina())

    expect(add(once, stamina())).toHaveLength(1)
  })

  it('takes a name of your own, since a bare key says little', () => {
    const entries = rename(add([], stamina()), load()[0].key, '体力')

    expect(entries[0].name).toBe('体力')
    expect(load()[0].name).toBe('体力')
  })

  it('keeps the old name when the new one is blank', () => {
    const entries = rename(add([], stamina()), load()[0].key, '   ')

    expect(entries[0].name).toBe('stamina')
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
    const entries = add([], { path: 'Gone.deep.value', keys: ['Gone', 'deep', 'value'], key: 'value' } as never)
    const [row] = resolveAll(entries)

    expect(row.found).toBe(false)
    expect(load()).toHaveLength(1)
  })

  it('answers whether a path is already kept', () => {
    const entries = add([], stamina())

    expect(saved(entries, 'LifeSim.modules.Stats._data.stamina')).toBe(true)
    expect(saved(entries, 'LifeSim.modules.Stats._data.kaihenPt')).toBe(false)
  })

  it('ignores a broken entry left by an older build', () => {
    localStorage.setItem(settingsFile('watchlist.json'), JSON.stringify({ saved: [{ name: 'x' }, null] }))

    expect(load()).toHaveLength(0)
  })
})
