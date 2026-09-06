export type EngineName = 'MV' | 'MZ'

export interface DataItem {
  id: number
  name: string
  description?: string
}

export interface DataState {
  id: number
  name: string
}

export interface DataMapInfo {
  id: number
  name: string
  parentId: number
}

export interface Battler {
  hp: number
  mhp: number
  mp: number
  mmp: number
  tp: number
  name(): string
  maxTp(): number
  setHp(value: number): void
  setMp(value: number): void
  setTp(value: number): void
  states(): DataState[]
  buff(paramId: number): number
  addState(stateId: number): void
  removeState(stateId: number): void
  clearStates(): void
  removeBuff(paramId: number): void
  removeAllBuffs(): void
}

export interface Actor extends Battler {
  _actorId: number
  _paramPlus: number[]
  level: number
  maxLevel(): number
  currentExp(): number
  param(paramId: number): number
  addParam(paramId: number, value: number): void
  changeLevel(level: number, show: boolean): void
  changeExp(exp: number, show: boolean): void
  gainHp(value: number): void
  gainMp(value: number): void
  gainTp(value: number): void
  setHp(value: number): void
  setMp(value: number): void
  setTp(value: number): void
  paySkillCost(skill: unknown): void
}

export interface Party {
  _gold: number
  members(): Actor[]
  numItems(item: DataItem): number
  maxItems(item: DataItem): number
  gainItem(item: DataItem, amount: number): void
  gainGold(amount: number): void
  loseGold(amount: number): void
  performEscape(): void
}

export interface Troop {
  members(): Battler[]
}

export interface Player {
  _through: boolean
  _encounterCount: number
  x: number
  y: number
  direction(): number
  canEncounter(): boolean
  reserveTransfer(mapId: number, x: number, y: number, direction: number, fadeType: number): void
  setPosition(x: number, y: number): void
}

export interface NumberStore {
  value(id: number): number
  setValue(id: number, value: number): void
}

export interface BooleanStore {
  value(id: number): boolean
  setValue(id: number, value: boolean): void
}

export interface KeyState {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  code: number
}
