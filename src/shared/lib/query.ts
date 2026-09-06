export interface Query {
  id: number | null
  tests: ((value: unknown) => boolean)[]
  loose: number[]
  terms: string[]
  empty: boolean
}

export interface Candidate {
  id: number | string
  value?: unknown
  texts?: (string | number | null | undefined)[]
}

const ID = /^#(\d+)$/
const COMPARE = /^(>=|<=|!=|==|=|>|<)\s*(-?\d+(?:\.\d+)?)$/
const RANGE = /^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/
const NUMBER = /^-?\d+(?:\.\d+)?$/

const TRUTHY = ['on', 'true', 'y', '켜짐']
const FALSY = ['off', 'false', 'n', '꺼짐']

/**
 * `quest` 名前 / `#12` ID / `500` ID または値 / `>1000` `100..200` 値 /
 * `on`・`off` 真偽値。複数語は AND で絞り込む。
 */
export function parseQuery(input: string | null | undefined): Query {
  const query: Query = { id: null, tests: [], loose: [], terms: [], empty: true }

  for (const token of String(input ?? '').trim().split(/\s+/)) {
    if (!token) continue
    query.empty = false

    const id = ID.exec(token)
    if (id) {
      query.id = Number(id[1])
      continue
    }

    const compare = COMPARE.exec(token)
    if (compare) {
      query.tests.push(comparison(compare[1]!, Number(compare[2])))
      continue
    }

    const range = RANGE.exec(token)
    if (range) {
      const low = Math.min(Number(range[1]), Number(range[2]))
      const high = Math.max(Number(range[1]), Number(range[2]))
      query.tests.push((value) => numeric(value) && Number(value) >= low && Number(value) <= high)
      continue
    }

    if (NUMBER.test(token)) {
      query.loose.push(Number(token))
      continue
    }

    const word = token.toLowerCase()

    if (TRUTHY.includes(word)) query.tests.push((value) => value === true)
    else if (FALSY.includes(word)) query.tests.push((value) => value === false)
    else query.terms.push(word)
  }

  return query
}

export function matches(query: Query, row: Candidate): boolean {
  if (query.empty) return true
  if (query.id !== null && Number(row.id) !== query.id) return false
  if (query.tests.some((test) => !test(row.value))) return false

  const byNumber = (needle: number) =>
    Number(row.id) === needle || (numeric(row.value) && Number(row.value) === needle)

  if (!query.loose.every(byNumber)) return false

  if (query.terms.length > 0) {
    const texts = (row.texts ?? []).map(text)
    return query.terms.every((term) => texts.some((value) => value.includes(term)))
  }

  return true
}

export function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).toLowerCase()
}

function comparison(operator: string, operand: number) {
  return (value: unknown): boolean => {
    if (!numeric(value)) return false

    const number = Number(value)

    switch (operator) {
      case '>':
        return number > operand
      case '<':
        return number < operand
      case '>=':
        return number >= operand
      case '<=':
        return number <= operand
      case '!=':
        return number !== operand
      default:
        return number === operand
    }
  }
}

function numeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
}
