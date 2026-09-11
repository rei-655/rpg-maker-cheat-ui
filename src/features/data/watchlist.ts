import { JsonStore } from '@/engine/storage'
import { fieldOf, readProbe, type Field, type Probe } from '@/engine/probe'

/**
 * 探索で見つけた値の保存。
 *
 * 手がかりの数字から絞り込むまでに手間がかかるので、一度たどり着いた場所は
 * 覚えておく。保存先はゲームの隣の cheat-settings/ なので、ゲームごとに別。
 */
export interface Watch {
  key: string
  name: string
  path: string
  keys: string[]
}

export interface WatchRow extends Watch {
  /** いま読める値。ロード直後などで入れ物がまだ無いことがある。 */
  field: Field
  found: boolean
}

const store = new JsonStore('watchlist.json')
const KEY = 'saved'

export function load(): Watch[] {
  const saved = store.get<Watch[]>(KEY, [])

  if (!Array.isArray(saved)) return []

  return saved
    .filter((entry) => entry && Array.isArray(entry.keys) && entry.keys.length > 0)
    .map((entry, index) => ({
      key: entry.key || `watch-legacy-${index}`,
      name: entry.name || entry.keys[entry.keys.length - 1] || '',
      path: entry.path || entry.keys.join('.'),
      keys: entry.keys
    }))
}

export function add(entries: Watch[], target: Probe | Watch, alias = ''): Watch[] {
  if (entries.some((entry) => entry.path === target.path)) return entries

  return save([
    ...entries,
    {
      key: `watch-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
      name: alias.trim() || target.key || target.path,
      path: target.path,
      keys: target.keys
    }
  ])
}

export function rename(entries: Watch[], key: string, name: string): Watch[] {
  return save(entries.map((entry) => (entry.key === key ? { ...entry, name: name.trim() || entry.name } : entry)))
}

export function remove(entries: Watch[], key: string): Watch[] {
  return save(entries.filter((entry) => entry.key !== key))
}

export function saved(entries: Watch[], path: string): boolean {
  return entries.some((entry) => entry.path === path)
}

/** 保存した場所をいま読み直す。見つからない項目も落とさず、印をつけて残す。 */
export function resolveAll(entries: Watch[]): WatchRow[] {
  return entries.map((entry) => {
    const value = readProbe(entry.keys)

    return { ...entry, field: fieldOf(entry.name, value), found: value !== undefined }
  })
}

function save(entries: Watch[]): Watch[] {
  store.set(KEY, entries)
  return entries
}
