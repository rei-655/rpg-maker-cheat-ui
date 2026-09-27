import { root } from './root'
import { safely } from './safety'
type Proto = { prototype: Record<string, unknown> }
type Self = Record<string, unknown>

let installed = false
let skipping = false

/** 押している間だけメッセージと戦闘ログを早送りする。 */
export function installMessageSkip(): void {
  if (installed) return
  installed = true

  patch('Window_Message', 'updateShowFast', function (this: Self, result) {
    if (skipping) {
      this._showFast = true
      this._pauseSkip = true
    }

    return result
  })

  patch('Window_Message', 'updateInput', function (this: Self, result) {
    if (this.pause && skipping) {
      this.pause = false
      if (!this._textState) (this.terminateMessage as () => void)?.call(this)
      return true
    }

    return result
  })

  patch('Window_ScrollText', 'scrollSpeed', (result) => (result as number) * (skipping ? 100 : 1))
  patch('Window_BattleLog', 'messageSpeed', (result) => (skipping ? 1 : result))
}

export const messageSkip = {
  get active() {
    return skipping
  },
  start: () => {
    skipping = true
  },
  stop: () => {
    skipping = false
  }
}

/**
 * 本来の処理を先に通し、その結果にだけ手を入れる。ゲーム側の例外はそのまま
 * ゲームに返し、こちらの手直しが投げたときは本来の結果を返す。
 */
function patch(className: string, method: string, adjust: (this: Self, result: unknown) => unknown): void {
  const target = root[className] as Proto | undefined
  const original = target?.prototype?.[method]

  if (typeof original !== 'function') return

  target!.prototype[method] = function (this: Self, ...args: unknown[]) {
    const result = (original as (...a: unknown[]) => unknown).apply(this, args)
    let adjusted = result

    safely(`${className}.${method}`, () => {
      adjusted = adjust.call(this, result)
    })

    return adjusted
  }
}
