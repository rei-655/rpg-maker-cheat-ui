import { beforeEach, describe as suite, expect, it } from 'vitest'
import { describe, probe, readProbe, writeProbe } from '@/engine/probe'

const game = () =>
  globalThis as unknown as {
    LifeSim: { modules: { Stats: { _data: Record<string, number>; _limits: Record<string, unknown> } } }
    Progress: { derived: { reads: number } }
    __resetGame(): void
  }

const stats = () => game().LifeSim.modules.Stats
const paths = () => probe().map((entry) => entry.path)

beforeEach(() => game().__resetGame())

suite('probe', () => {
  it('finds a number a plugin keeps outside the variable list', () => {
    // 実機の RJ01607700 はここに体力を置いていた。変数一覧には出てこない。
    const found = probe().find((entry) => entry.path === 'LifeSim.modules.Stats._data.stamina')

    expect(found).toBeDefined()
    expect(found!.value).toBe(45)
    expect(found!.owner).toBe('LifeSim.modules.Stats._data')
    expect(found!.key).toBe('stamina')
  })

  it('keeps the path as segments so a key containing a dot still resolves', () => {
    const found = probe().find((entry) => entry.path === 'LifeSim.modules.Stats._data.kaihenPt')

    expect(found!.keys).toEqual(['LifeSim', 'modules', 'Stats', '_data', 'kaihenPt'])
  })

  it('leaves out the engine internals another screen already covers', () => {
    const found = paths()

    expect(found.some((path) => path.startsWith('$gameVariables'))).toBe(false)
    expect(found.some((path) => path.startsWith('$dataSystem'))).toBe(false)
    expect(found.some((path) => path.startsWith('Graphics'))).toBe(false)
  })

  it('skips drawing objects, which would bury real values under coordinates', () => {
    expect(paths().some((path) => path.startsWith('noisySprite'))).toBe(false)
  })

  it('still reaches the party, where gold and levels live', () => {
    expect(paths()).toContain('$gameParty._gold')
  })

  it('reads a value back through its path', () => {
    expect(readProbe(['LifeSim', 'modules', 'Stats', '_data', 'stamina'])).toBe(45)
    expect(readProbe(['LifeSim', 'nope', 'stamina'])).toBeUndefined()
  })

  it('writes a value into the game', () => {
    expect(writeProbe(['LifeSim', 'modules', 'Stats', '_data', 'stamina'], 90)).toBe(true)
    expect(stats()._data.stamina).toBe(90)
  })

  it('reports a write that did not take, instead of claiming success', () => {
    const frozen = Object.freeze({ locked: 1 })
    Object.assign(globalThis, { frozenThing: frozen })

    expect(writeProbe(['frozenThing', 'locked'], 5)).toBe(false)
    expect(writeProbe(['nothing', 'here'], 5)).toBe(false)
  })
})

suite('probe reaches values that are not numbers', () => {
  // 体力だけがチートの対象ではない。解放フラグは真偽値、章は文字列で持つ。
  it('finds a text value', () => {
    const found = probe().find((entry) => entry.path === 'Progress.chapter')

    expect(found!.kind).toBe('string')
    expect(found!.value).toBe('prologue')
  })

  it('finds a flag whether it is on or off', () => {
    const kinds = probe().filter((entry) => entry.path === 'Progress.unlocked' || entry.path === 'Progress.locked')

    expect(kinds.map((entry) => entry.value)).toEqual([true, false])
  })

  it('skips an empty string, which is never the value you are hunting', () => {
    expect(paths()).not.toContain('Progress.blank')
  })

  it('looks inside a Map, which Object.keys cannot see', () => {
    const found = probe().find((entry) => entry.path === 'Progress.flags.metSister')

    expect(found!.value).toBe(true)
  })

  it('writes back into a Map', () => {
    expect(writeProbe(['Progress', 'flags', 'sawEnding'], true)).toBe(true)
    expect(readProbe(['Progress', 'flags', 'sawEnding'])).toBe(true)
  })

  it('finds a property a plugin hid from enumeration', () => {
    const found = probe().find((entry) => entry.path === 'Progress.hidden.secretPoints')

    expect(found!.value).toBe(1234)
  })

  it('never calls a getter while walking, since that can move the game', () => {
    const derived = game().Progress.derived

    probe()

    expect(derived.reads).toBe(0)
    expect(paths()).not.toContain('Progress.derived.doubled')
  })
})

suite('probe skips the right things', () => {
  it('drops the engine drawing classes', () => {
    expect(paths().some((path) => path.startsWith('noisySprite'))).toBe(false)
  })

  it('keeps a plugin class that merely starts with the same word', () => {
    // WindowStats は Window_Base ではない。前方一致で弾くと道連れになる。
    expect(paths()).toContain('pluginWindow.rank')
  })
})

suite('describe', () => {
  it('shows the other fields the same object holds', () => {
    const structure = describe(['LifeSim', 'modules', 'Stats', '_data'])

    expect(structure!.path).toBe('LifeSim.modules.Stats._data')
    expect(structure!.fields.map((field) => field.key)).toEqual(['stamina', 'kaihenPt', 'favorability'])
    expect(structure!.fields.every((field) => field.editable)).toBe(true)
  })

  it('marks a nested object as something to open rather than edit', () => {
    const structure = describe(['LifeSim', 'modules', 'Stats'])
    const limits = structure!.fields.find((field) => field.key === '_limits')!

    expect(limits.kind).toBe('object')
    expect(limits.editable).toBe(false)
    expect(limits.size).toBe(1)
  })

  it('names the type of the object being looked at', () => {
    expect(describe(['LifeSim'])!.type).toBe('Object')
  })

  it('does read getters here, because one object is being looked at on purpose', () => {
    const structure = describe(['Progress', 'derived'])
    const doubled = structure!.fields.find((field) => field.key === 'doubled')!

    expect(doubled.value).toBe(100)
    expect(doubled.accessor).toBe(true)
    expect(doubled.editable).toBe(false)
  })

  it('reports the real size of a Map and a Set instead of calling them empty', () => {
    const structure = describe(['Progress'])
    const byKey = (key: string) => structure!.fields.find((field) => field.key === key)!

    expect(byKey('flags').text).toBe('Map {2}')
    expect(byKey('visited').text).toBe('Set {1}')
  })

  it('returns nothing for a path that is not an object', () => {
    expect(describe(['LifeSim', 'modules', 'Stats', '_data', 'stamina'])).toBeNull()
    expect(describe(['missing'])).toBeNull()
  })
})
