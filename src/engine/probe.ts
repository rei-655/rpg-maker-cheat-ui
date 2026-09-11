import { root } from './root'

/**
 * ゲーム本体の変数ではなく、プラグインが持つ独自の入れ物を探す。
 *
 * 体力や好感度を $gameVariables に置かず、自前のオブジェクトに持つゲームは
 * 珍しくない。そういう値はツクールの変数一覧には出てこないので、
 * グローバルから辿れるオブジェクトを歩いて数値の置き場所を集める。
 */

export interface Probe {
  /** 表示用の全体パス。'LifeSim.modules.Stats._data.stamina' */
  path: string
  /** 解決用の区切り。キーに . が含まれても壊れない。 */
  keys: string[]
  /** 入れ物までのパス。 */
  owner: string
  key: string
  value: number
}

export type FieldKind = 'number' | 'string' | 'boolean' | 'array' | 'object' | 'empty' | 'other'

export interface Field {
  key: string
  kind: FieldKind
  /** 一覧に出す短い表現。 */
  text: string
  value: unknown
  /** その場で書き換えられるか。 */
  editable: boolean
  /** 配列なら長さ、オブジェクトならキー数。 */
  size: number
}

export interface Structure {
  path: string
  type: string
  fields: Field[]
}

const MAX_DEPTH = 6
const MAX_NODES = 30000
const MAX_ARRAY = 64
const MAX_RESULTS = 4000
const MAX_FIELDS = 200
const TEXT_CAP = 60

/** ブラウザ・PIXI・ツクール本体。歩いても操作したい値は出てこない。 */
const SKIP_ROOTS = [
  'window', 'self', 'top', 'parent', 'frames', 'globalThis', 'document', 'location',
  'history', 'navigator', 'console', 'localStorage', 'sessionStorage', 'performance',
  'crypto', 'caches', 'indexedDB', 'chrome', 'process', 'require', 'module', 'exports',
  'global', 'nw', 'Buffer',
  'PIXI', 'Graphics', 'Bitmap', 'Stage', 'WebAudio', 'Html5Audio', 'Video', 'Input',
  'TouchInput', 'Utils', 'JsonEx', 'Decrypter', 'ResourceHandler', 'ImageManager',
  'AudioManager', 'EffectManager', 'FontManager', 'StorageManager', 'ConfigManager',
  'TextManager', 'ColorManager', 'SceneManager', 'PluginManager', 'DataManager',
  'BattleManager', 'SoundManager', 'Effekseer', 'effekseer',
  // 別画面が受け持つもの、そして中身が多すぎて意味を成さないもの。
  '$gameVariables', '$gameSwitches', '$gameSelfSwitches', '$gameMap', '$gameScreen',
  '$gameTemp', '$gameMessage',
  '__CHEAT_UI__', '__CHEAT_UI_LOCALE__', 'cheatDebug'
]

/** 描画部品。数千の座標が採れてしまうだけで役に立たない。 */
const SKIP_TYPES = [
  'Sprite', 'Window', 'Bitmap', 'Stage', 'Tilemap', 'Scene_', 'Spriteset', 'WebGL',
  'HTML', 'CSS', 'SVG', 'Canvas', 'Audio', 'Image', 'Node', 'Event', 'Promise', 'Error'
]

export function probe(): Probe[] {
  const found: Probe[] = []
  const seen = new WeakSet<object>()
  let budget = MAX_NODES

  function walk(node: unknown, keys: string[], depth: number): void {
    if (budget <= 0 || found.length >= MAX_RESULTS) return
    if (!walkable(node) || seen.has(node)) return

    seen.add(node)

    for (const [key, value] of entries(node)) {
      if (budget <= 0 || found.length >= MAX_RESULTS) return
      budget -= 1

      if (typeof value === 'number' && Number.isFinite(value)) {
        const full = keys.concat(key)
        found.push({ path: full.join('.'), keys: full, owner: keys.join('.'), key, value })
        continue
      }

      if (depth < MAX_DEPTH) walk(value, keys.concat(key), depth + 1)
    }
  }

  for (const name of Object.keys(root)) {
    if (SKIP_ROOTS.indexOf(name) >= 0 || name.indexOf('$data') === 0) continue
    walk(read(root, name), [name], 0)
  }

  return found
}

export function readProbe(keys: string[]): unknown {
  return resolve(keys)
}

export function writeProbe(keys: string[], value: unknown): boolean {
  const owner = resolve(keys.slice(0, -1))
  const key = keys[keys.length - 1]

  if (owner === null || typeof owner !== 'object' || key === undefined) return false

  try {
    ;(owner as Record<string, unknown>)[key] = value
    return typeof value === 'number' || typeof value === 'boolean'
      ? (owner as Record<string, unknown>)[key] === value
      : true
  } catch {
    return false
  }
}

/** keys が指すオブジェクトそのものの中身を並べる。見つけた値の周りを読むため。 */
export function describe(keys: string[]): Structure | null {
  const node = resolve(keys)

  if (node === null || typeof node !== 'object') return null

  return {
    path: keys.join('.'),
    type: typeName(node),
    fields: entries(node, MAX_FIELDS).map(([key, value]) => field(key, value))
  }
}

function field(key: string, value: unknown): Field {
  if (value === null || value === undefined) {
    return { key, kind: 'empty', text: String(value), value, editable: false, size: 0 }
  }

  if (typeof value === 'number') {
    return { key, kind: 'number', text: String(value), value, editable: true, size: 0 }
  }

  if (typeof value === 'boolean') {
    return { key, kind: 'boolean', text: String(value), value, editable: true, size: 0 }
  }

  if (typeof value === 'string') {
    return { key, kind: 'string', text: cut(value), value, editable: true, size: value.length }
  }

  if (Array.isArray(value)) {
    return { key, kind: 'array', text: `[${value.length}]`, value, editable: false, size: value.length }
  }

  if (typeof value === 'object') {
    const size = entries(value).length
    return { key, kind: 'object', text: `${typeName(value)} {${size}}`, value, editable: false, size }
  }

  return { key, kind: 'other', text: typeof value, value, editable: false, size: 0 }
}

function resolve(keys: string[]): unknown {
  let node: unknown = root

  for (const key of keys) {
    if (node === null || typeof node !== 'object') return undefined
    node = read(node as Record<string, unknown>, key)
  }

  return node
}

/** getter が投げるゲームがある。読めない値は無いものとして扱う。 */
function read(node: Record<string, unknown> | object, key: string): unknown {
  try {
    return (node as Record<string, unknown>)[key]
  } catch {
    return undefined
  }
}

function entries(node: object, limit = MAX_ARRAY): [string, unknown][] {
  const keys = Array.isArray(node)
    ? node.slice(0, limit).map((_, index) => String(index))
    : own(node).slice(0, MAX_FIELDS)

  return keys.map((key) => [key, read(node, key)])
}

function own(node: object): string[] {
  try {
    return Object.keys(node)
  } catch {
    return []
  }
}

function walkable(value: unknown): value is object {
  if (value === null || typeof value !== 'object') return false
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return false

  const node = value as Record<string, unknown>

  if (typeof node.nodeType === 'number') return false
  if (node.window === value || node.self === value) return false

  const name = typeName(value)

  return !SKIP_TYPES.some((prefix) => name.indexOf(prefix) === 0)
}

function typeName(value: object): string {
  try {
    const name = Object.getPrototypeOf(value)?.constructor?.name
    return typeof name === 'string' && name !== '' ? name : 'Object'
  } catch {
    return 'Object'
  }
}

function cut(value: string): string {
  return value.length > TEXT_CAP ? `${value.slice(0, TEXT_CAP)}…` : value
}
