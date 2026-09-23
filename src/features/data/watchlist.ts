import { JsonStore } from '@/engine/storage'
import { fieldOf, readProbe, writeProbe, type Field } from '@/engine/probe'
import { has, switches, variables } from '@/engine/globals'
import { coerceLike } from '@/shared/lib/coerce'

/**
 * 手を入れたい値の保存。
 *
 * 探索で見つけた場所だけでなく、変数とスイッチも同じ一覧に入る。利用者から
 * 見れば「よく触る値」は一つの束で、それがツクールの変数かプラグインの
 * オブジェクトかは関心の外にある。
 *
 * 保存先はゲームの隣の cheat-settings/ なので、ゲームごとに別の一覧になる。
 */
export type WatchKind = 'path' | 'variable' | 'switch'

export type Target =
  | { kind: 'path'; keys: string[]; name: string }
  | { kind: 'variable'; id: number; name: string }
  | { kind: 'switch'; id: number; name: string }

export interface Watch {
  key: string
  name: string
  kind: WatchKind
  /** 重複を弾くための一意な印。'var:6' や 'LifeSim.modules...' */
  ref: string
  keys: string[]
  id: number
}

export interface WatchRow extends Watch {
  field: Field
  /** いま読める場所か。ロード直後は入れ物がまだ無いことがある。 */
  found: boolean
}

const store = new JsonStore('watchlist.json')
const KEY = 'saved'

export function refOf(target: Target | Watch): string {
  if (target.kind === 'variable') return `var:${target.id}`
  if (target.kind === 'switch') return `sw:${target.id}`

  return target.keys.join('.')
}

export function load(): Watch[] {
  const saved = store.get<unknown[]>(KEY, [])

  if (!Array.isArray(saved)) return []

  return saved.map(migrate).filter((entry): entry is Watch => entry !== null)
}

export function add(entries: Watch[], target: Target): Watch[] {
  const ref = refOf(target)

  if (entries.some((entry) => entry.ref === ref)) return entries

  return save([
    ...entries,
    {
      key: `watch-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
      name: target.name.trim() || ref,
      kind: target.kind,
      ref,
      keys: target.kind === 'path' ? target.keys : [],
      id: target.kind === 'path' ? 0 : target.id
    }
  ])
}

export function rename(entries: Watch[], key: string, name: string): Watch[] {
  return save(entries.map((entry) => (entry.key === key ? { ...entry, name: name.trim() || entry.name } : entry)))
}

export function remove(entries: Watch[], key: string): Watch[] {
  return save(entries.filter((entry) => entry.key !== key))
}

export function saved(entries: Watch[], ref: string): boolean {
  return entries.some((entry) => entry.ref === ref)
}

/** 保存した場所をいま読み直す。見つからない項目も落とさず、印をつけて残す。 */
export function resolveAll(entries: Watch[]): WatchRow[] {
  return entries.map((entry) => {
    const value = readWatch(entry)

    return { ...entry, field: fieldOf(entry.name, value), found: value !== undefined }
  })
}

export function readWatch(entry: Watch): unknown {
  if (entry.kind === 'variable') return has('$gameVariables') ? variables().value(entry.id) : undefined
  if (entry.kind === 'switch') return has('$gameSwitches') ? switches().value(entry.id) : undefined

  return readProbe(entry.keys)
}

/** 型を保ったまま書き戻す。数値の変数が文字列になるとイベント条件が壊れる。 */
export function writeWatch(entry: Watch, raw: string): boolean {
  const current = readWatch(entry)

  if (current === undefined) return false

  const next = coerceLike(raw, current)

  if (entry.kind === 'variable') {
    variables().setValue(entry.id, next as number)
    return variables().value(entry.id) === next
  }

  if (entry.kind === 'switch') {
    switches().setValue(entry.id, next as boolean)
    return switches().value(entry.id) === next
  }

  return writeProbe(entry.keys, next)
}

/** 2.2 までは探索の値しか保存できず、種類を持っていなかった。 */
function migrate(raw: unknown): Watch | null {
  if (!raw || typeof raw !== 'object') return null

  const entry = raw as Partial<Watch> & { path?: string }
  const kind: WatchKind = entry.kind ?? 'path'

  if (kind === 'path') {
    if (!Array.isArray(entry.keys) || entry.keys.length === 0) return null

    return {
      key: entry.key || `watch-${entry.keys.join('-')}`,
      name: entry.name || entry.keys[entry.keys.length - 1] || '',
      kind,
      ref: entry.ref || entry.path || entry.keys.join('.'),
      keys: entry.keys,
      id: 0
    }
  }

  if (typeof entry.id !== 'number' || !Number.isFinite(entry.id)) return null

  return {
    key: entry.key || `watch-${kind}-${entry.id}`,
    name: entry.name || `#${entry.id}`,
    kind,
    ref: entry.ref || `${kind === 'variable' ? 'var' : 'sw'}:${entry.id}`,
    keys: [],
    id: entry.id
  }
}

function save(entries: Watch[]): Watch[] {
  store.set(KEY, entries)
  return entries
}
