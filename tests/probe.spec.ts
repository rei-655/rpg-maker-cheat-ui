import { beforeEach, describe as suite, expect, it } from 'vitest'
import { describe, probe, readProbe, writeProbe } from '@/engine/probe'

const game = () =>
  globalThis as unknown as {
    LifeSim: { modules: { Stats: { _data: Record<string, number>; _limits: Record<string, unknown> } } }
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

  it('returns nothing for a path that is not an object', () => {
    expect(describe(['LifeSim', 'modules', 'Stats', '_data', 'stamina'])).toBeNull()
    expect(describe(['missing'])).toBeNull()
  })
})
