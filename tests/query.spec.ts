import { describe, expect, it } from 'vitest'
import { matches, parseQuery } from '@/shared/lib/query'

const row = (id: number, value: unknown, ...texts: string[]) => ({ id, value, texts })

const hits = (search: string, candidates: ReturnType<typeof row>[]) =>
  candidates.filter((candidate) => matches(parseQuery(search), candidate)).map((c) => c.id)

describe('parseQuery', () => {
  it('treats an empty query as "everything"', () => {
    expect(parseQuery('').empty).toBe(true)
    expect(parseQuery('   ').empty).toBe(true)
    expect(matches(parseQuery(''), row(1, 0, 'anything'))).toBe(true)
  })

  it('matches names case-insensitively', () => {
    expect(hits('quest', [row(1, 0, 'Quest Flag'), row(2, 0, 'Gold')])).toEqual([1])
  })

  it('requires every term to match', () => {
    const candidates = [row(1, 0, 'Quest Flag'), row(2, 0, 'Quest Done')]
    expect(hits('quest flag', candidates)).toEqual([1])
  })

  it('restricts to an id with #', () => {
    expect(hits('#2', [row(1, 2, 'a'), row(2, 9, 'b')])).toEqual([2])
  })

  it('matches a bare number against the id or the value', () => {
    expect(hits('500', [row(500, 0, 'a'), row(7, 500, 'b'), row(9, 1, 'c')])).toEqual([500, 7])
  })

  it('compares values', () => {
    const candidates = [row(1, 50, 'a'), row(2, 150, 'b'), row(3, 500, 'c')]

    expect(hits('>100', candidates)).toEqual([2, 3])
    expect(hits('<=150', candidates)).toEqual([1, 2])
    expect(hits('!=150', candidates)).toEqual([1, 3])
    expect(hits('=500', candidates)).toEqual([3])
  })

  it('supports inclusive ranges in either order', () => {
    const candidates = [row(1, 50, 'a'), row(2, 150, 'b'), row(3, 500, 'c')]

    expect(hits('100..500', candidates)).toEqual([2, 3])
    expect(hits('500..100', candidates)).toEqual([2, 3])
  })

  it('combines constraints with AND', () => {
    const candidates = [row(1, 150, 'gold'), row(2, 150, 'quest'), row(3, 9, 'gold')]
    expect(hits('gold >100', candidates)).toEqual([1])
  })

  it('filters booleans with on and off', () => {
    const candidates = [row(1, true, 'a'), row(2, false, 'b')]

    expect(hits('on', candidates)).toEqual([1])
    expect(hits('off', candidates)).toEqual([2])
  })

  it('ignores rows whose value is not numeric when comparing', () => {
    expect(hits('>100', [row(1, 'not a number', 'a')])).toEqual([])
  })
})
