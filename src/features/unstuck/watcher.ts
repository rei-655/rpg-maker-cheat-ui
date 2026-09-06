import { switchNames, switches, variableNames, variables } from '@/engine/globals'

export type ChangeKind = 'switch' | 'variable'

export interface Change {
  key: string
  kind: ChangeKind
  id: number
  name: string
  before: boolean | number
  after: boolean | number
}

/**
 * 進めないときに何が起きたかを見るための記録。
 *
 * 名前のないスイッチが 2000 個並んでいても意味は読めないが、「たった今ゲームが
 * 触ったもの」なら意味がある。記録してから詰まった行動を試し、差分を見る。
 */
export class GameWatcher {
  private switchSnapshot = new Map<number, boolean>()
  private variableSnapshot = new Map<number, number>()

  recording = false

  record(): void {
    this.switchSnapshot = new Map()
    this.variableSnapshot = new Map()

    for (let id = 1; id < switchNames().length; id += 1) {
      this.switchSnapshot.set(id, switches().value(id))
    }

    for (let id = 1; id < variableNames().length; id += 1) {
      this.variableSnapshot.set(id, variables().value(id))
    }

    this.recording = true
  }

  stop(): void {
    this.recording = false
    this.switchSnapshot = new Map()
    this.variableSnapshot = new Map()
  }

  /** 記録した時点から変わったものだけ。スイッチを先に並べる。 */
  diff(): Change[] {
    if (!this.recording) return []

    const changes: Change[] = []
    const switchLabels = switchNames()
    const variableLabels = variableNames()

    for (const [id, before] of this.switchSnapshot) {
      const after = switches().value(id)
      if (after === before) continue

      changes.push({
        key: `s${id}`,
        kind: 'switch',
        id,
        name: switchLabels[id] ?? '',
        before,
        after
      })
    }

    for (const [id, before] of this.variableSnapshot) {
      const after = variables().value(id)
      if (after === before) continue

      changes.push({
        key: `v${id}`,
        kind: 'variable',
        id,
        name: variableLabels[id] ?? '',
        before,
        after
      })
    }

    return changes
  }

  /** 記録した値に戻し、その値を新しい基準にする。 */
  revert(change: Change): void {
    if (change.kind === 'switch') {
      switches().setValue(change.id, change.before as boolean)
      this.switchSnapshot.set(change.id, change.before as boolean)
      return
    }

    variables().setValue(change.id, change.before as number)
    this.variableSnapshot.set(change.id, change.before as number)
  }

  /** 現在の値を新しい基準にする。次の差分は今からの変化になる。 */
  rebase(change: Change): void {
    if (change.kind === 'switch') {
      this.switchSnapshot.set(change.id, switches().value(change.id))
      return
    }

    this.variableSnapshot.set(change.id, variables().value(change.id))
  }
}

export const watcher = new GameWatcher()
