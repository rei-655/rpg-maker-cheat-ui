import { JsonStore } from '@/engine/storage'
import { currentMapId, player } from '@/engine/globals'
import { mapName } from '@/engine/maps'

export interface Bookmark {
  key: string
  name: string
  mapId: number
  x: number
  y: number
}

const store = new JsonStore('locations.json')
const KEY = 'saved'

/** 各項目は安定した key を持つ。旧版はページ内の行番号で削除していた。 */
export function load(): Bookmark[] {
  const saved = store.get<Bookmark[]>(KEY, [])

  return Array.isArray(saved)
    ? saved.map((entry, index) => ({
        ...entry,
        key: entry.key || `legacy-${index}-${entry.mapId}-${entry.x}-${entry.y}`
      }))
    : []
}

function save(entries: Bookmark[]): Bookmark[] {
  store.set(KEY, entries)
  return entries
}

export function addCurrent(entries: Bookmark[], alias = ''): Bookmark[] {
  const mapId = currentMapId()

  return save([
    ...entries,
    {
      key: `loc-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
      name: alias.trim() || mapName(mapId) || `Map ${mapId}`,
      mapId,
      x: player().x,
      y: player().y
    }
  ])
}

export function rename(entries: Bookmark[], key: string, name: string): Bookmark[] {
  return save(entries.map((entry) => (entry.key === key ? { ...entry, name } : entry)))
}

export function remove(entries: Bookmark[], key: string): Bookmark[] {
  return save(entries.filter((entry) => entry.key !== key))
}
