import { isMV } from './engine'

export const HOST_ID = 'cheat-ui-root'

type Handler = (event: Event) => void
type Wrappable = Record<string, unknown>

let installed = false

export function uiHost(): HTMLElement | null {
  return document.getElementById(HOST_ID)
}

/** このイベントはチートウィンドウ内で起きたか。 */
export function isInsideUi(event: Event | null): boolean {
  const host = uiHost()
  const target = event?.target

  return !!host && target instanceof Node && host.contains(target)
}

export function isTypingInUi(): boolean {
  const active = document.activeElement
  const host = uiHost()

  if (!host || !(active instanceof HTMLElement) || !host.contains(active)) return false

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable === true
}

/**
 * ウィンドウ内のクリック・キー・ホイールをゲームに渡さない。
 * 旧版はモーダルの矩形座標で判定していたため、移動やリサイズで壊れた。
 */
export function installInputGuards(): void {
  if (installed) return
  installed = true

  const touch = (globalThis as unknown as { TouchInput?: Wrappable }).TouchInput
  const input = (globalThis as unknown as { Input?: Wrappable }).Input

  if (touch) {
    for (const name of ['_onMouseDown', '_onMouseMove', '_onMouseUp'] as const) {
      guard(touch, name)
    }
    guardWheel(touch)
  }

  if (input) {
    guard(input, '_onKeyDown')
    guard(input, '_onKeyUp')
  }
}

function guard(owner: Wrappable, method: string): void {
  const original = owner[method]
  if (typeof original !== 'function') return

  owner[method] = function wrapped(this: unknown, event: Event) {
    if (isInsideUi(event) || (method.startsWith('_onKey') && isTypingInUi())) return

    return (original as Handler).call(this, event)
  }
}

/** ホイール量の格納先は MV が _events、MZ が _newState。誤ると無反応になる。 */
function guardWheel(touch: Wrappable): void {
  const original = touch._onWheel

  if (typeof original !== 'function') return

  touch._onWheel = function wrapped(this: Wrappable, event: WheelEvent) {
    if (isInsideUi(event)) return

    const state = (isMV() ? this._events : this._newState) as
      | { wheelX: number; wheelY: number }
      | undefined

    if (!state) return (original as Handler).call(this, event)

    state.wheelX += event.deltaX
    state.wheelY += event.deltaY
    event.preventDefault()
  }
}
