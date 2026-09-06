import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOST_ID, installInputGuards, isInsideUi, isTypingInUi } from '@/engine/input'

const engine = () =>
  globalThis as unknown as {
    TouchInput: {
      _events: { wheelX: number; wheelY: number }
      _newState: { wheelX: number; wheelY: number }
      _onWheel(event: unknown): void
      _onMouseDown(event: unknown): void
    }
    Input: { _onKeyDown(event: unknown): void }
    Utils: { RPGMAKER_NAME: string }
  }

const wheel = (target: EventTarget, deltaY: number) => ({
  target,
  deltaX: 0,
  deltaY,
  preventDefault() {}
})

let host: HTMLElement
let inside: HTMLElement
let outside: HTMLElement
let mouseDown: ReturnType<typeof vi.fn>
let keyDown: ReturnType<typeof vi.fn>

beforeAll(() => {
  // ガードが包む前に元の関数を控える
  mouseDown = vi.fn()
  keyDown = vi.fn()
  engine().TouchInput._onMouseDown = mouseDown
  engine().Input._onKeyDown = keyDown

  installInputGuards()
})

beforeEach(() => {
  document.body.innerHTML = ''

  host = document.createElement('div')
  host.id = HOST_ID
  inside = document.createElement('button')
  host.appendChild(inside)

  outside = document.createElement('canvas')
  document.body.append(host, outside)

  mouseDown.mockClear()
  keyDown.mockClear()
  engine().Utils.RPGMAKER_NAME = 'MZ'
})

describe('event ownership', () => {
  it('decides by containment, not by the window rectangle', () => {
    expect(isInsideUi({ target: inside } as unknown as Event)).toBe(true)
    expect(isInsideUi({ target: outside } as unknown as Event)).toBe(false)
    expect(isInsideUi(null)).toBe(false)
  })

  it('reports typing only for editable fields inside the window', () => {
    const field = document.createElement('input')
    host.appendChild(field)
    field.focus()
    expect(isTypingInUi()).toBe(true)

    inside.focus()
    expect(isTypingInUi()).toBe(false)

    const gameField = document.createElement('input')
    document.body.appendChild(gameField)
    gameField.focus()
    expect(isTypingInUi()).toBe(false)
  })
})

describe('guards', () => {
  it('swallows clicks made inside the window', () => {
    engine().TouchInput._onMouseDown({ target: inside })
    expect(mouseDown).not.toHaveBeenCalled()

    engine().TouchInput._onMouseDown({ target: outside })
    expect(mouseDown).toHaveBeenCalledTimes(1)
  })

  it('swallows keystrokes while a field in the window has focus', () => {
    const field = document.createElement('input')
    host.appendChild(field)
    field.focus()

    engine().Input._onKeyDown({ target: field })
    expect(keyDown).not.toHaveBeenCalled()

    field.blur()
    engine().Input._onKeyDown({ target: outside })
    expect(keyDown).toHaveBeenCalledTimes(1)
  })

  it('writes wheel deltas where the running engine reads them', () => {
    engine().TouchInput._events.wheelY = 0
    engine().TouchInput._newState.wheelY = 0

    engine().Utils.RPGMAKER_NAME = 'MV'
    engine().TouchInput._onWheel(wheel(outside, 5))
    expect(engine().TouchInput._events.wheelY).toBe(5)
    expect(engine().TouchInput._newState.wheelY).toBe(0)

    engine().Utils.RPGMAKER_NAME = 'MZ'
    engine().TouchInput._onWheel(wheel(outside, 7))
    expect(engine().TouchInput._newState.wheelY).toBe(7)
  })

  it('does not scroll the game when the wheel is used in the window', () => {
    engine().TouchInput._newState.wheelY = 0
    engine().TouchInput._onWheel(wheel(inside, 99))

    expect(engine().TouchInput._newState.wheelY).toBe(0)
  })
})
