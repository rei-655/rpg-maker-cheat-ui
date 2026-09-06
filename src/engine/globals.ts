import { root } from './root'
import type {
  Actor,
  BooleanStore,
  DataItem,
  DataMapInfo,
  DataState,
  NumberStore,
  Party,
  Player,
  Troop
} from './types'

interface RpgGlobals {
  Utils: { isNwjs(): boolean; RPGMAKER_NAME: string }
  SceneManager: Record<string, unknown> & { _scene?: unknown; goto(s: unknown): void; push(s: unknown): void; pop(): void }
  DataManager: { maxSavefiles(): number; saveGame(slot: number): unknown; loadGame(slot: number): unknown }
  BattleManager: Record<string, unknown>
  SoundManager: { playEscape(): void }
  $dataSystem: { variables: string[]; switches: string[]; terms: { params: string[] } }
  $dataItems: (DataItem | null)[]
  $dataWeapons: (DataItem | null)[]
  $dataArmors: (DataItem | null)[]
  $dataStates: (DataState | null)[]
  $dataMapInfos: (DataMapInfo | null)[]
  $gameVariables: NumberStore
  $gameSwitches: BooleanStore
  $gameParty: Party
  $gameTroop: Troop
  $gamePlayer: Player
  $gameMap: { mapId(): number }
  $gameSystem: { onBeforeSave?(): void; onAfterLoad?(): void }
  Scene_Battle: unknown
  Scene_Map: unknown
  Scene_Save: unknown
  Scene_Load: unknown
  Scene_Title: unknown
  Game_Actor: new () => Actor
}

/** ゲームのグローバル変数への唯一の入口。型のない参照をここに閉じ込める。 */
export function rpg<K extends keyof RpgGlobals>(key: K): RpgGlobals[K] {
  return root[key] as RpgGlobals[K]
}

export function has(key: keyof RpgGlobals): boolean {
  return root[key] != null
}

export const party = () => rpg('$gameParty')
export const troop = () => rpg('$gameTroop')
export const player = () => rpg('$gamePlayer')
export const variables = () => rpg('$gameVariables')
export const switches = () => rpg('$gameSwitches')

export function variableNames(): string[] {
  return has('$dataSystem') ? (rpg('$dataSystem').variables ?? []) : []
}

export function switchNames(): string[] {
  return has('$dataSystem') ? (rpg('$dataSystem').switches ?? []) : []
}

export function paramNames(): string[] {
  return has('$dataSystem') ? (rpg('$dataSystem').terms?.params ?? []) : []
}

export function partyMembers(): Actor[] {
  return has('$gameParty') ? party().members() : []
}

export function troopMembers() {
  return has('$gameTroop') ? troop().members() : []
}

export function currentMapId(): number {
  return has('$gameMap') ? rpg('$gameMap').mapId() : 0
}

export function inBattle(): boolean {
  if (!has('SceneManager') || !has('Scene_Battle')) return false

  const scene = rpg('SceneManager')._scene
  return scene instanceof (rpg('Scene_Battle') as new () => unknown)
}
