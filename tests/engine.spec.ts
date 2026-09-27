import { afterEach, describe, expect, it } from 'vitest'
import { dirOfPage, settingsDir, settingsFile } from '@/engine/engine'

/** jsdom では pathname を history から動かせる。実機のページ位置を真似る。 */
function atPage(path: string): void {
  history.replaceState({}, '', path)
}

afterEach(() => atPage('/'))

describe('where settings are written', () => {
  it('sits next to index.html for a plain MV game', () => {
    atPage('/G:/games/demo/www/index.html')

    expect(settingsDir()).toBe('G:/games/demo/www/cheat-settings')
  })

  it('sits next to index.html for a plain MZ game', () => {
    atPage('/G:/games/demo/index.html')

    expect(settingsDir()).toBe('G:/games/demo/cheat-settings')
  })

  it('follows a game repackaged into Electron, where www does not exist', () => {
    // NW.js をやめた配布物。本体は resources/app/src にあり、www/ は無い。
    atPage('/G:/games/demo/resources/app/src/index.html')

    expect(settingsDir()).toBe('G:/games/demo/resources/app/src/cheat-settings')
  })

  it('handles a path the browser percent-encoded', () => {
    atPage('/G:/games/%E3%83%91%E3%83%91%E6%B4%BB/www/index.html')

    expect(settingsDir()).toBe('G:/games/パパ活/www/cheat-settings')
  })

  it('keeps a posix path whole, since the drive-letter fix must not fire', () => {
    atPage('/home/rei/games/demo/www/index.html')

    expect(settingsDir()).toBe('/home/rei/games/demo/www/cheat-settings')
  })

  it('falls back to the working directory when the page tells us nothing', () => {
    expect(settingsDir()).toBe('./cheat-settings')
  })

  it('keeps an NW.js app path relative to the app, not the drive root', () => {
    // NW.js は chrome-extension://<id>/www/index.html で開く
    expect(dirOfPage('chrome-extension:', '/www/index.html')).toBe('./www')
    expect(dirOfPage('chrome-extension:', '/index.html')).toBeNull()
  })

  it('survives a raw percent sign in the path', () => {
    expect(dirOfPage('file:', '/G:/games/50%off/www/index.html')).toBe('G:/games/50%off/www')
  })

  it('names files inside that folder', () => {
    atPage('/G:/games/demo/index.html')

    expect(settingsFile('ui.json')).toBe('G:/games/demo/cheat-settings/ui.json')
  })
})
