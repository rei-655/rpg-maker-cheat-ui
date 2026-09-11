import { vi } from 'vitest'

interface Stubs {
  variables?: string[]
  switches?: string[]
}

/** テスト対象が触る範囲だけの最小 RPG Maker スタブ。 */
export function installEngine(stubs: Stubs = {}): void {
  // 実機を真似る: maxBattleMembers を絞るプラグインが入ると members() は
  // 参加メンバーだけを返し、控えが見えなくなる。
  const actors = [makeActor('Harold', 1), makeActor('Therese', 2), makeActor('Marsha', 3)]
  const variableValues: Record<number, unknown> = {}
  const switchValues: Record<number, boolean> = {}
  const owned: Record<number, number> = {}

  Object.assign(globalThis, {
    Utils: { isNwjs: () => false, RPGMAKER_NAME: 'MZ' },

    $dataSystem: {
      variables: stubs.variables ?? ['', 'Gold Counter', 'Quest Flag', ''],
      switches: stubs.switches ?? ['', 'Opening Done', 'Secret Found'],
      terms: { params: ['MHP', 'MMP', 'ATK', 'DEF', 'MAT', 'MDF', 'AGI', 'LUK'] }
    },

    $dataItems: [
      null,
      { id: 1, name: 'Potion', description: 'Heals 100 HP' },
      { id: 2, name: 'Elixir', description: 'Full recovery' },
      { id: 3, name: '', description: '' }
    ],
    $dataWeapons: [null, { id: 1, name: 'Sword', description: 'Sharp' }],
    $dataArmors: [null, { id: 1, name: 'Shield', description: 'Sturdy' }],
    $dataStates: [null, { id: 1, name: 'Poison' }, { id: 2, name: 'Sleep' }],

    $dataMapInfos: [
      null,
      { id: 1, name: 'Town', parentId: 0 },
      { id: 2, name: 'Inn', parentId: 1 },
      // 意図的な循環。旧版の再帰探索はここでスタックを溢れさせていた
      { id: 3, name: 'Loop A', parentId: 4 },
      { id: 4, name: 'Loop B', parentId: 3 }
    ],

    $gameVariables: {
      value: (id: number) => variableValues[id] ?? 0,
      setValue: (id: number, value: unknown) => {
        variableValues[id] = value
      }
    },

    $gameSwitches: {
      value: (id: number) => !!switchValues[id],
      setValue: (id: number, value: boolean) => {
        switchValues[id] = value
      }
    },

    $gameParty: {
      _gold: 500,
      members: () => actors.slice(0, 2),
      allMembers: () => actors,
      numItems: (item: { id: number }) => owned[item.id] ?? 0,
      maxItems: () => 99,
      gainItem: (item: { id: number }, amount: number) => {
        owned[item.id] = Math.max(0, (owned[item.id] ?? 0) + amount)
      },
      gainGold: (amount: number) => {
        ;(globalThis as never as { $gameParty: { _gold: number } }).$gameParty._gold += amount
      },
      loseGold: (amount: number) => {
        ;(globalThis as never as { $gameParty: { _gold: number } }).$gameParty._gold -= amount
      }
    },

    $gameTroop: { members: () => [] },
    $gameMap: { mapId: () => 1 },
    $gamePlayer: {
      _through: false,
      x: 5,
      y: 7,
      direction: () => 2,
      reserveTransfer: vi.fn(),
      setPosition: vi.fn(),
      canEncounter: () => true
    },

    TouchInput: {
      _events: { wheelX: 0, wheelY: 0 },
      _newState: { wheelX: 0, wheelY: 0 },
      _onWheel: vi.fn(),
      _onMouseDown: vi.fn(),
      _onMouseMove: vi.fn(),
      _onMouseUp: vi.fn()
    },

    Input: { _onKeyDown: vi.fn(), _onKeyUp: vi.fn() },

    __resetGame() {
      for (const key of Object.keys(variableValues)) delete variableValues[Number(key)]
      for (const key of Object.keys(switchValues)) delete switchValues[Number(key)]
      for (const key of Object.keys(owned)) delete owned[Number(key)]
    }
  })
}

function makeActor(name: string, id: number) {
  const states: { id: number; name: string }[] = []

  return {
    _actorId: id,
    _paramPlus: [0, 0, 0, 0, 0, 0, 0, 0],
    hp: 120,
    mhp: 300,
    mp: 10,
    mmp: 40,
    tp: 5,
    level: 12,
    name: () => name,
    maxTp: () => 100,
    maxLevel: () => 99,
    currentExp: () => 1200,
    param: (paramId: number) => 40 + paramId,
    addParam: vi.fn(),
    changeLevel: vi.fn(),
    changeExp: vi.fn(),
    setHp(value: number) {
      this.hp = value
    },
    setMp(value: number) {
      this.mp = value
    },
    setTp(value: number) {
      this.tp = value
    },
    gainHp: vi.fn(),
    gainMp: vi.fn(),
    gainTp: vi.fn(),
    paySkillCost: vi.fn(),
    states: () => states,
    buff: () => 0,
    addState: (stateId: number) => states.push({ id: stateId, name: `State ${stateId}` }),
    removeState: vi.fn(),
    clearStates: () => states.splice(0, states.length),
    removeBuff: vi.fn(),
    removeAllBuffs: vi.fn()
  }
}

installEngine()
