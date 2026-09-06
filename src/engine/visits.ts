import { JsonStore } from './storage'
import { currentMapId, has, player } from './globals'

export interface Visit {
  mapId: number
  x: number
  y: number
  at: number
}

const LIMIT = 40
const store = new JsonStore('visits.json')
const KEY = 'recent'

let installed = false

export function visits(): Visit[] {
  const saved = store.get<Visit[]>(KEY, [])
  return Array.isArray(saved) ? saved : []
}

export function forgetVisits(): void {
  store.set(KEY, [])
}

function remember(mapId: number): void {
  if (!mapId) return

  const rest = visits().filter((visit) => visit.mapId !== mapId)
  const entry: Visit = {
    mapId,
    x: has('$gamePlayer') ? player().x : 0,
    y: has('$gamePlayer') ? player().y : 0,
    at: Date.now()
  }

  store.set(KEY, [entry, ...rest].slice(0, LIMIT))
}

/**
 * 入ったマップを記録しておく。500 件の生のマップ一覧より、
 * 「さっき通った場所」のほうが戻りたい先である場合がほとんど。
 */
export function installVisitLog(): void {
  if (installed) return
  installed = true

  const gameMap = (globalThis as unknown as { Game_Map?: { prototype: Record<string, unknown> } }).Game_Map
  const setup = gameMap?.prototype?.setup

  if (typeof setup !== 'function') return

  gameMap!.prototype.setup = function (this: unknown, ...args: unknown[]) {
    const result = (setup as (...a: unknown[]) => unknown).apply(this, args)

    // 座標が入るのは転送のあとなので、次のフレームで拾う
    setTimeout(() => remember(currentMapId()), 0)
    return result
  }
}
