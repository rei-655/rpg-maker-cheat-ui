import { has, party, rpg } from './globals'
import type { DataItem, Party } from './types'

/**
 * 所持品の読み書き。
 *
 * numItems と maxItems をそのまま信じると壊れるゲームがある。
 *
 * YEP_ItemCore の「独立アイテム」を使うゲームは、武器や防具を 1 本ずつ別の
 * 複製として持つ。複製は $dataWeapons の後ろに新しい項目として足され、
 * 元の項目を baseItemId で指す。元の項目の numItems は意味を持たず、
 * maxItems は 1 を返し、上限は品目ごとではなく種類全体で共有される。
 *
 * さらにエンジン本体を書き換えて numItems が装備品に true を返すゲームもある。
 */
const DEFAULT_MAX = 99

type IndependentParty = Party & {
  numIndependentItems?(item: DataItem): unknown
  getIndependentItemTypeMax?(item: DataItem): unknown
  getIndependentItemTypeCur?(item: DataItem): unknown
  itemContainer?(item: DataItem): Record<number, unknown> | null
}

const members = () => party() as IndependentParty

export function isIndependent(item: DataItem): boolean {
  if (!has('DataManager')) return false

  const manager = rpg('DataManager') as { isIndependent?(item: DataItem): unknown }
  if (typeof manager.isIndependent !== 'function') return false

  try {
    return manager.isIndependent(item) === true
  } catch {
    return false
  }
}

/** 独立アイテムの複製。一覧に出すと、持つたびに行が 1 本ずつ増えていく。 */
export function isGeneratedCopy(item: DataItem): boolean {
  return typeof item.baseItemId === 'number' && item.baseItemId > 0
}

/** 元の項目だけを残す。 */
export function databaseEntries(source: (DataItem | null)[] | undefined): DataItem[] {
  return (source ?? []).filter((item): item is DataItem => !!item && !isGeneratedCopy(item))
}

export function heldCount(item: DataItem): number {
  const target = members()

  if (isIndependent(item) && typeof target.numIndependentItems === 'function') {
    return count(target.numIndependentItems(item))
  }

  const reported = target.numItems(item)
  if (typeof reported === 'number' && Number.isFinite(reported)) return Math.max(0, reported)

  // 数ではなく true などを返すように改造されている。入れ物を直接読む。
  return count(target.itemContainer?.(item)?.[item.id])
}

/**
 * この品目に持たせられる最大数。
 *
 * 独立アイテムは種類全体で上限を共有するので、この品目に割ける余地は
 * 「種類の空き + いま持っている分」になる。書き込む直前に毎回計算し直す。
 */
export function heldMax(item: DataItem): number {
  const target = members()

  if (
    isIndependent(item) &&
    typeof target.getIndependentItemTypeMax === 'function' &&
    typeof target.getIndependentItemTypeCur === 'function'
  ) {
    const room = count(target.getIndependentItemTypeMax(item)) - count(target.getIndependentItemTypeCur(item))
    return Math.max(0, room) + heldCount(item)
  }

  const reported = target.maxItems(item)
  return typeof reported === 'number' && Number.isFinite(reported) && reported > 0 ? reported : DEFAULT_MAX
}

/** 指定の数にそろえる。増減はエンジン自身の gainItem に任せる。 */
export function setHeld(item: DataItem, requested: number): number {
  const target = Math.min(Math.max(0, Math.trunc(requested)), heldMax(item))
  const delta = target - heldCount(item)

  if (delta !== 0) members().gainItem(item, delta)

  return heldCount(item)
}

function count(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0
}
