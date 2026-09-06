import { has, player, rpg } from './globals'

export interface MapEntry {
  id: number
  name: string
  path: string
}

/** ルートから対象までの id。欠損と parentId の循環に耐える。 */
export function ancestors(id: number): number[] {
  if (!has('$dataMapInfos')) return []

  const infos = rpg('$dataMapInfos')
  const path: number[] = []
  const seen = new Set<number>()

  let current = id

  while (current && infos[current] && !seen.has(current)) {
    seen.add(current)
    path.push(current)
    current = infos[current]!.parentId
  }

  return path.reverse()
}

export function mapName(id: number): string {
  const info = has('$dataMapInfos') ? rpg('$dataMapInfos')[id] : null
  return info ? info.name || `#${id}` : ''
}

export function mapPath(id: number): string {
  return ancestors(id).map(mapName).join(' / ')
}

export function listMaps(): MapEntry[] {
  if (!has('$dataMapInfos')) return []

  return rpg('$dataMapInfos')
    .filter((info): info is NonNullable<typeof info> => !!info)
    .map((info) => ({ id: info.id, name: info.name || '', path: mapPath(info.id) }))
}

export function teleport(mapId: number, x: number, y: number): void {
  player().reserveTransfer(mapId, x, y, player().direction(), 0)
  player().setPosition(x, y)
}
