import { root } from './root'

/**
 * ゲーム本体の変数ではなく、プラグインが持つ独自の入れ物を探す。
 *
 * 体力や好感度を $gameVariables に置かず、自前のオブジェクトに持つゲームは
 * 珍しくない。そういう値はツクールの変数一覧には出てこないので、
 * グローバルから辿れるオブジェクトを歩いて値の置き場所を集める。
 *
 * 数値だけでは足りない。解放フラグを真偽値で、進行段階を文字列で持つ
 * ゲームもあるので、その場で書き換えられる型はすべて拾う。
 */

export type ProbeKind = 'number' | 'string' | 'boolean'
export type FieldKind = ProbeKind | 'array' | 'object' | 'map' | 'set' | 'empty' | 'other'

export interface Probe {
  /** 表示用の全体パス。'LifeSim.modules.Stats._data.stamina' */
  path: string
  /** 解決用の区切り。キーに . が含まれても壊れない。 */
  keys: string[]
  /** 入れ物までのパス。 */
  owner: string
  key: string
  kind: ProbeKind
  value: number | string | boolean
}

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
  /** ゲッター越しの値。副作用があり得るので歩くときは触らない。 */
  accessor?: true
}

/** 一覧の一項目。ゲッター由来かどうかで扱いが変わる。 */
interface Entry {
  key: string
  value: unknown
  accessor?: true
  /** setter のないゲッター。書いても戻るので編集させない。 */
  readOnly?: true
}

export interface Structure {
  path: string
  type: string
  fields: Field[]
  /** 表示を打ち切った件数。黙って隠すと数え間違いのもとになる。 */
  hidden: number
}

const MAX_DEPTH = 8
const MAX_NODES = 60000
const MAX_ARRAY = 256
/** これより長い配列はドット絵やマップデータ。歩いても意味がない。 */
const HUGE_ARRAY = 8192
const MAX_FIELDS = 200
const TEXT_CAP = 60
const STRING_CAP = 200

/** 型ごとに上限を分ける。文字列が溢れて数値を押し出すのを防ぐ。 */
const MAX_RESULTS: Record<ProbeKind, number> = { number: 4000, string: 1500, boolean: 1500 }

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

/**
 * 描画まわりのクラス。前方一致で弾くと WindowStats のようなプラグインの
 * クラスまで道連れになるので、完全一致と _ 区切りだけを見る。
 */
const SKIP_TYPES = [
  'Sprite', 'Window', 'Bitmap', 'Stage', 'Tilemap', 'TilingSprite', 'Graphics',
  'Container', 'ParticleContainer', 'Texture', 'BaseTexture', 'RenderTexture',
  'Filter', 'Point', 'ObservablePoint', 'Rectangle', 'Matrix', 'Transform',
  'WebGLRenderer', 'CanvasRenderer', 'Promise', 'Error', 'WeakMap', 'WeakSet'
]

const SKIP_TYPE_GROUPS = ['Sprite_', 'Window_', 'Scene_', 'Spriteset_']

export function probe(): Probe[] {
  const found: Record<ProbeKind, Probe[]> = { number: [], string: [], boolean: [] }
  const seen = new WeakSet<object>()
  let budget = MAX_NODES

  function collect(keys: string[], key: string, value: number | string | boolean): void {
    const kind = typeof value as ProbeKind
    const bucket = found[kind]

    if (bucket.length >= MAX_RESULTS[kind]) return

    const full = keys.concat(key)
    bucket.push({ path: full.join('.'), keys: full, owner: keys.join('.'), key, kind, value })
  }

  function walk(node: unknown, keys: string[], depth: number): void {
    if (budget <= 0 || !walkable(node) || seen.has(node)) return

    seen.add(node)

    // 歩いている最中はゲッターを呼ばない。副作用のあるゲームがある。
    for (const { key, value } of entries(node, MAX_ARRAY, false)) {
      if (budget <= 0) return
      budget -= 1

      if (keepable(value)) {
        collect(keys, key, value as number | string | boolean)
        continue
      }

      if (depth < MAX_DEPTH) walk(value, keys.concat(key), depth + 1)
    }
  }

  for (const name of Object.keys(root)) {
    if (SKIP_ROOTS.indexOf(name) >= 0 || name.indexOf('$data') === 0) continue
    walk(read(root, name), [name], 0)
  }

  return found.number.concat(found.string, found.boolean)
}

export function readProbe(keys: string[]): unknown {
  return resolve(keys)
}

export function writeProbe(keys: string[], value: unknown): boolean {
  const owner = resolve(keys.slice(0, -1))
  const key = keys[keys.length - 1]

  if (owner === null || typeof owner !== 'object' || key === undefined) return false

  try {
    if (owner instanceof Map) {
      owner.set(key, value)
      return owner.get(key) === value
    }

    ;(owner as Record<string, unknown>)[key] = value

    // 書けたつもりで弾かれていることがある。読み直して確かめる。
    return typeof value === 'object' || (owner as Record<string, unknown>)[key] === value
  } catch {
    return false
  }
}

/** keys が指すオブジェクトそのものの中身を並べる。見つけた値の周りを読むため。 */
export function describe(keys: string[]): Structure | null {
  const node = resolve(keys)

  if (node === null || typeof node !== 'object') return null

  // ここは利用者が意図して覗いている一つのオブジェクトなので、ゲッターも読む。
  const all = entries(node, MAX_FIELDS + 1, true)
  const shown = all.slice(0, MAX_FIELDS)

  return {
    path: keys.join('.'),
    type: typeName(node),
    fields: shown.map((entry) => fieldOf(entry.key, entry.value, entry)),
    hidden: all.length > MAX_FIELDS ? Math.max(0, count(node) - MAX_FIELDS) : 0
  }
}

/** 一つの値を、型と編集可否つきの見出しにする。保存した値の一覧でも使う。 */
export function fieldOf(key: string, value: unknown, flags: Partial<Entry> = {}): Field {
  const field = (kind: FieldKind, text: string, writable: boolean, size = 0): Field => {
    const editable = writable && !flags.readOnly
    return flags.accessor ? { key, kind, text, value, editable, size, accessor: true } : { key, kind, text, value, editable, size }
  }

  if (value === null || value === undefined) return field('empty', String(value), false)
  if (typeof value === 'number') return field('number', String(value), true)
  if (typeof value === 'boolean') return field('boolean', String(value), true)
  if (typeof value === 'string') return field('string', cut(value), true, value.length)
  if (Array.isArray(value)) return field('array', `[${value.length}]`, false, value.length)

  if (value instanceof Map) return field('map', `Map {${value.size}}`, false, value.size)
  if (value instanceof Set) return field('set', `Set {${value.size}}`, false, value.size)

  if (typeof value === 'object') {
    const size = count(value)
    return field('object', `${typeName(value)} {${size}}`, false, size)
  }

  return field('other', typeof value, false)
}

function keepable(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true

  return typeof value === 'string' && value !== '' && value.length <= STRING_CAP
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
function read(node: object, key: string): unknown {
  try {
    if (node instanceof Map) return node.get(key)
    return (node as Record<string, unknown>)[key]
  } catch {
    return undefined
  }
}

/**
 * 中身の一覧。列挙できない自前のプロパティも拾うため Object.keys では足りない。
 * accessors が false のあいだはゲッターを呼ばず、名前だけ飛ばす。
 */
function entries(node: object, limit: number, accessors: boolean): Entry[] {
  if (node instanceof Map) {
    const out: Entry[] = []

    for (const key of node.keys()) {
      if (out.length >= limit) break
      if (typeof key === 'string') out.push({ key, value: node.get(key) })
    }

    return out
  }

  if (node instanceof Set) return []

  if (Array.isArray(node)) {
    if (node.length > HUGE_ARRAY) return []

    return node.slice(0, limit).map((value, index) => ({ key: String(index), value }))
  }

  const out: Entry[] = []
  const taken: Record<string, true> = {}

  for (const key of names(node)) {
    if (out.length >= limit) break

    const descriptor = describeProperty(node, key)
    if (!descriptor) continue

    taken[key] = true

    if ('value' in descriptor) {
      out.push({ key, value: descriptor.value })
      continue
    }

    if (accessors && typeof descriptor.get === 'function') out.push(accessor(node, key, descriptor))
  }

  // クラスで書かれたプラグインは hp のような値をプロトタイプのゲッターに置く。
  // 自前のプロパティだけ見ていると、その値が一覧に出てこない。
  if (accessors) out.push(...inherited(node, taken, limit - out.length))

  return out
}

function accessor(node: object, key: string, descriptor: PropertyDescriptor): Entry {
  const entry: Entry = { key, value: read(node, key), accessor: true }

  if (typeof descriptor.set !== 'function') entry.readOnly = true

  return entry
}

/** プロトタイプ側のゲッターだけを拾う。メソッドは値ではないので見ない。 */
function inherited(node: object, taken: Record<string, true>, room: number): Entry[] {
  const out: Entry[] = []
  let proto: unknown = Object.getPrototypeOf(node)

  while (proto !== null && proto !== Object.prototype && out.length < room) {
    for (const key of names(proto as object)) {
      if (out.length >= room) break
      if (key === 'constructor' || taken[key]) continue

      const descriptor = describeProperty(proto as object, key)
      if (!descriptor || typeof descriptor.get !== 'function') continue

      taken[key] = true
      out.push(accessor(node, key, descriptor))
    }

    proto = Object.getPrototypeOf(proto as object)
  }

  return out
}

function names(node: object): string[] {
  try {
    return Object.getOwnPropertyNames(node)
  } catch {
    return []
  }
}

function describeProperty(node: object, key: string): PropertyDescriptor | undefined {
  try {
    return Object.getOwnPropertyDescriptor(node, key)
  } catch {
    return undefined
  }
}

function count(node: object): number {
  if (node instanceof Map || node instanceof Set) return node.size
  if (Array.isArray(node)) return node.length

  return names(node).length
}

function walkable(value: unknown): value is object {
  if (value === null || typeof value !== 'object') return false
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return false
  if (value instanceof Set) return false

  const node = value as Record<string, unknown>

  if (typeof node.nodeType === 'number') return false
  if (node.window === value || node.self === value) return false

  return !skippedType(typeName(value))
}

function skippedType(name: string): boolean {
  if (SKIP_TYPES.indexOf(name) >= 0) return true

  return SKIP_TYPE_GROUPS.some((group) => name.indexOf(group) === 0 && name.length > group.length)
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
