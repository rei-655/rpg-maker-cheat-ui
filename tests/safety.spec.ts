import { describe, expect, it, vi } from 'vitest'
import { guarded, safely } from '@/engine/safety'

/**
 * この UI はゲームのページに間借りしている。こちらの例外がツクールまで届くと
 * エラー画面が出て、遊んでいる側から見ればゲームが落ちる。
 */
describe('failures stay on our side of the fence', () => {
  it('returns the value when nothing goes wrong', () => {
    expect(safely('reading', () => 42)).toBe(42)
  })

  it('swallows a throw and says nothing happened', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(safely('reading', () => {
      throw new Error('builtin is broken')
    })).toBeUndefined()

    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('leaves a trace, so a silent failure is still findable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    safely('recording the map you entered', () => {
      throw new Error('boom')
    })

    expect(String(warn.mock.calls[0][0])).toContain('recording the map you entered')
    warn.mockRestore()
  })

  it('wraps a callback the game will call back into', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const hook = guarded('hooking', () => {
      throw new Error('boom')
    })

    expect(() => hook()).not.toThrow()
    warn.mockRestore()
  })

  it('passes the arguments through to the wrapped callback', () => {
    const seen: unknown[] = []
    guarded('hooking', (...args: unknown[]) => seen.push(...args))(1, 'two')

    expect(seen).toEqual([1, 'two'])
  })
})
