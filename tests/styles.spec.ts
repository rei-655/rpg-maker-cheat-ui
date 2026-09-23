import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CSS = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cheat-ui.css')

/**
 * この UI はゲームのドキュメントに間借りしている。スコープ外の規則が 1 つでも
 * あればロード表示がずれ、キャンバスの寸法まで変わる。旧版はこれで壊れていた。
 */
describe('stylesheet scoping', () => {
  const css = readFileSync(CSS, 'utf-8')

  const selectors = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((block) => block.slice(block.lastIndexOf('{') === -1 ? 0 : 0, block.indexOf('{')))
    .filter((selector) => selector.trim() && !selector.trim().startsWith('@'))
    .flatMap((selector) => selector.split(','))
    .map((selector) => selector.trim())
    .filter(Boolean)

  it('has rules at all', () => {
    expect(selectors.length).toBeGreaterThan(50)
  })

  it('confines every selector to the cheat host', () => {
    const escapees = selectors.filter((selector) => !selector.startsWith('#cheat-ui-root'))
    expect(escapees).toEqual([])
  })

  it('never targets html, body or the universal selector at the top level', () => {
    expect(css).not.toMatch(/(^|})\s*(html|body)\s*[{,]/)
    expect(css).not.toMatch(/(^|}|,)\s*\*\s*[{,]/)
  })

  it('never claims full viewport height, which would grow the game body', () => {
    expect(css).not.toContain('min-height:100vh')
    expect(css).not.toContain('min-height: 100vh')
  })
})

/**
 * 見た目の約束は目でしか確かめられない、ということはない。破ると一目で
 * 「実務の道具」に見えなくなる規則は、機械で見張れる。
 */
describe('badges do not look like a framework demo', () => {
  const css = readFileSync(CSS, 'utf-8')
  const pills = css.match(/\.pill--[a-z]+\s*\{[^}]*\}/g) ?? []

  it('has status badges at all', () => {
    expect(pills.length).toBeGreaterThanOrEqual(3)
  })

  it('never puts a status colour on the border', () => {
    expect(pills.filter((rule) => rule.includes('border'))).toEqual([])
  })

  it('leaves the text at the body colour, so a table is not confetti', () => {
    expect(pills.filter((rule) => rule.includes('color:') && !rule.includes('background'))).toEqual([])
  })

  it('never rounds a badge, chip or button into a pill shape', () => {
    // 状態を示す dot は円のままでよい。禁止したいのは錠剤型のバッジのほう。
    const rounded = css.match(/\.(pill|chip|btn|tab)[^{]*\{[^}]*border-radius:\s*(999|9999)px[^}]*\}/g) ?? []

    expect(rounded).toEqual([])
    expect(css).not.toMatch(/border-radius:\s*9999?px/)
  })
})

describe('text is not shrunk in the name of density', () => {
  const css = readFileSync(CSS, 'utf-8')
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((match) => Number(match[1]))

  it('reads sizes from the built stylesheet', () => {
    expect(sizes.length).toBeGreaterThan(20)
  })

  it('has nothing below 12px, which is where a tool starts feeling cramped', () => {
    expect(sizes.filter((size) => size < 12)).toEqual([])
  })

  it('sets the body around 14px', () => {
    expect(css).toMatch(/font-size:\s*14px/)
  })
})

describe('tables scroll instead of folding', () => {
  const css = readFileSync(CSS, 'utf-8')

  it('keeps cells on one line', () => {
    expect(css).toMatch(/\.table td\s*\{[^}]*white-space:\s*nowrap/)
  })

  it('offers an escape for the long prose column', () => {
    expect(css).toMatch(/\.table td\.wrap\s*\{[^}]*white-space:\s*normal/)
  })

  it('lets the wrapper scroll sideways rather than squashing the columns', () => {
    expect(css).toMatch(/\.table-wrap\s*\{[^}]*overflow-x:\s*auto/)
  })
})

describe('nothing is pinned wider than a narrow window', () => {
  const css = readFileSync(CSS, 'utf-8')

  it('pairs every wide fixed width with a max-width escape', () => {
    // 固定幅はモバイル幅で溢れる一番の原因。逃げ道のないものを見張る。
    const wide = css.match(/\{[^}]*[^-]width:\s*([2-9]\d\d|\d{4,})px[^}]*\}/g) ?? []

    expect(wide.filter((rule) => !rule.includes('max-width'))).toEqual([])
  })
})
