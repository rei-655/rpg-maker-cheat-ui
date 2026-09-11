import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = readFileSync(join(ROOT, 'dist', 'cheat-ui.js'), 'utf-8')
const LOADER = readFileSync(join(ROOT, 'plugin', 'CheatUILoader.js'), 'utf-8')

/**
 * ツクール MV 1.6 が同梱する NW.js 0.29 は Chromium 66。
 * 新しい構文や組み込みメソッドが 1 つ混ざるだけで、読み込んだ瞬間に落ちて
 * 何も起きなくなる。実機でこれに当たったので、ビルド結果を直接見張る。
 */
describe('the bundle runs on the oldest engine we support', () => {
  it.each([
    ['optional catch binding (Chromium 66)', /catch\s*\{/],
    ['Object.fromEntries (Chromium 73)', /Object\.fromEntries/],
    ['Array.prototype.flat (Chromium 69)', /\.flatMap\(|\.flat\(/],
    ['String.prototype.matchAll (Chromium 73)', /\.matchAll\(/],
    ['String.prototype.replaceAll (Chromium 85)', /\.replaceAll\(/],
    ['Array.prototype.at (Chromium 92)', /\.at\(-?\d/],
    ['optional chaining (Chromium 80)', /\?\./],
    ['nullish coalescing (Chromium 80)', /\?\?[^)]/],
    ['logical assignment (Chromium 85)', /\?\?=|\|\|=|&&=/]
  ])('has no %s', (_name, pattern) => {
    expect(BUNDLE).not.toMatch(pattern)
  })

  it('only reads globalThis behind a typeof guard', () => {
    const uses = BUNDLE.match(/.{24}globalThis/g) ?? []

    for (const use of uses) {
      // 文字列の中の "globalThis" は参照ではない。読み出す箇所だけを見る。
      if (/["'`]globalThis$/.test(use)) continue

      expect(use, use).toMatch(/typeof globalThis/)
    }
  })

  it('has the loader define globalThis before the bundle loads', () => {
    expect(LOADER).toMatch(/typeof window\.globalThis === 'undefined'/)
    expect(LOADER.indexOf('window.globalThis = window')).toBeLessThan(LOADER.indexOf('script.src'))
  })
})
