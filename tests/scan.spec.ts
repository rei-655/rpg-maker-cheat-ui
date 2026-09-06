import { beforeEach, describe, expect, it } from 'vitest'
import { ValueScan } from '@/shared/lib/scan'

describe('ValueScan', () => {
  let values: Record<number, number>
  let scan: ValueScan

  beforeEach(() => {
    values = { 1: 10, 2: 20, 3: 30 }
    scan = new ValueScan((id) => values[id])
  })

  it('starts inactive', () => {
    expect(scan.active).toBe(false)
    expect(scan.count).toBe(0)
    expect(scan.refine('changed')).toBe(0)
  })

  it('keeps only the entries that changed', () => {
    scan.start([1, 2, 3])
    values[2] = 21

    expect(scan.refine('changed')).toBe(1)
    expect(scan.has(2)).toBe(true)
    expect(scan.has(1)).toBe(false)
  })

  it('keeps only the entries that stayed put', () => {
    scan.start([1, 2, 3])
    values[2] = 21

    expect(scan.refine('unchanged')).toBe(2)
    expect(scan.has(2)).toBe(false)
  })

  it('distinguishes increases from decreases', () => {
    scan.start([1, 2, 3])
    values[1] = 11
    values[2] = 19

    expect(scan.refine('increased')).toBe(1)
    expect(scan.has(1)).toBe(true)
  })

  it('narrows across several passes', () => {
    scan.start([1, 2, 3])

    values[1] = 11
    values[2] = 21
    expect(scan.refine('changed')).toBe(2)

    values[1] = 12
    expect(scan.refine('changed')).toBe(1)
    expect(scan.has(1)).toBe(true)
    expect(scan.passes).toBe(2)
  })

  it('matches an exact value', () => {
    scan.start([1, 2, 3])
    expect(scan.refine('equals', 20)).toBe(1)
    expect(scan.has(2)).toBe(true)
  })

  it('re-snapshots after every pass, so the next one compares against now', () => {
    scan.start([1, 2, 3])
    values[1] = 11
    scan.refine('changed')

    expect(scan.refine('unchanged')).toBe(1)
  })

  it('forgets everything on reset', () => {
    scan.start([1, 2, 3])
    scan.reset()

    expect(scan.active).toBe(false)
    expect(scan.count).toBe(0)
  })
})
