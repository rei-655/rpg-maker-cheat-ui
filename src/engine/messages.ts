type Proto = { prototype: Record<string, unknown> }

let installed = false
let skipping = false

/** 押している間だけメッセージと戦闘ログを早送りする。 */
export function installMessageSkip(): void {
  if (installed) return
  installed = true

  patch('Window_Message', 'updateShowFast', function (this: Record<string, unknown>, call) {
    call()
    if (skipping) {
      this._showFast = true
      this._pauseSkip = true
    }
  })

  patch('Window_Message', 'updateInput', function (this: Record<string, unknown>, call) {
    const result = call()

    if (this.pause && skipping) {
      this.pause = false
      if (!this._textState) (this.terminateMessage as () => void)?.call(this)
      return true
    }

    return result
  })

  patch('Window_ScrollText', 'scrollSpeed', (call) => (call() as number) * (skipping ? 100 : 1))
  patch('Window_BattleLog', 'messageSpeed', (call) => (skipping ? 1 : (call() as number)))
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

function patch(
  className: string,
  method: string,
  wrapper: (this: Record<string, unknown>, call: () => unknown) => unknown
): void {
  const target = (globalThis as unknown as Record<string, Proto | undefined>)[className]
  const original = target?.prototype?.[method]

  if (typeof original !== 'function') return

  target!.prototype[method] = function (this: Record<string, unknown>, ...args: unknown[]) {
    return wrapper.call(this, () => (original as (...a: unknown[]) => unknown).apply(this, args))
  }
}
