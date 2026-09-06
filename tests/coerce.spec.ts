import { describe, expect, it } from 'vitest'
import { clamp, coerceLike, toInt } from '@/shared/lib/coerce'

describe('coerceLike', () => {
  it('keeps a numeric variable numeric', () => {
    expect(coerceLike('10', 0)).toBe(10)
    expect(typeof coerceLike('10', 0)).toBe('number')
  })

  it('leaves the original in place when the input is not a number', () => {
    expect(coerceLike('abc', 42)).toBe(42)
  })

  it('reads booleans from words the UI can produce', () => {
    expect(coerceLike('true', false)).toBe(true)
    expect(coerceLike('on', false)).toBe(true)
    expect(coerceLike('0', true)).toBe(false)
  })

  it('turns numeric input into a number when the slot was empty', () => {
    expect(coerceLike('7', null)).toBe(7)
    expect(coerceLike('name', null)).toBe('name')
  })

  it('keeps strings as strings', () => {
    expect(coerceLike('7', 'label')).toBe('7')
  })
})

describe('toInt', () => {
  it('truncates and rejects junk', () => {
    expect(toInt('12.7')).toBe(12)
    expect(toInt('')).toBeNull()
    expect(toInt('abc')).toBeNull()
    expect(toInt('abc', 0)).toBe(0)
  })
})

describe('clamp', () => {
  it('bounds both ends', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(99, 0, 10)).toBe(10)
  })
})
