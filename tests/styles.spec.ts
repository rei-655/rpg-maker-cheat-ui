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
