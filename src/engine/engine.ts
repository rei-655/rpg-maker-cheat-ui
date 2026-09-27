import { has, rpg } from './globals'
import { root } from './root'
import type { EngineName } from './types'

export function engineName(): EngineName {
  return has('Utils') && rpg('Utils').RPGMAKER_NAME === 'MV' ? 'MV' : 'MZ'
}

export const isMV = () => engineName() === 'MV'

export function isNwjs(): boolean {
  return has('Utils') && rpg('Utils').isNwjs()
}

/**
 * 設定は index.html と同じ階層に置く。
 *
 * MV は www/、MZ は直下という区別だけでは足りない。NW.js をやめて Electron で
 * 包み直した配布物があり、そこでは本体が resources/app/src に入っていて、
 * 作業ディレクトリもゲームのフォルダとは限らない。ページの位置から決める。
 */
export function settingsDir(): string {
  const dir = pageDir()

  return dir ? `${dir}/cheat-settings` : './cheat-settings'
}

/** index.html があるフォルダ。取れなければ作業ディレクトリに任せる。 */
function pageDir(): string | null {
  const location = root.location as Location | undefined

  return dirOfPage(String(location?.protocol ?? ''), String(location?.pathname ?? ''))
}

/**
 * ページの URL からフォルダを出す。
 *
 * NW.js はアプリを chrome-extension://<id>/www/index.html で開く。このパスは
 * アプリの根（作業ディレクトリ）からの相対で、ドライブの根ではない。そのまま
 * 使うと MV の設定が G:/www/cheat-settings に行ってしまう。
 */
export function dirOfPage(protocol: string, pathname: string): string | null {
  if (pathname === '' || pathname === '/') return null

  const dir = decodePath(pathname).replace(/\/[^/]*$/, '')

  if (protocol === 'chrome-extension:') return dir ? `.${dir}` : null

  // file:///G:/game/src/index.html では先頭のスラッシュがドライブ文字の前に残る
  return dir.replace(/^\/([A-Za-z]:)/, '$1') || null
}

/**
 * 生の % を含むパスで decodeURIComponent は投げる。設定の場所はバンドルの
 * 読み込み時に決まるので、ここで投げると起動の境界より前でゲームが落ちる。
 */
function decodePath(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

export function settingsFile(name: string): string {
  return `${settingsDir()}/${name}`
}

/** セーブ / ロードの戻り値は MZ が Promise、MV が boolean。 */
export function asPromise<T>(result: T | Promise<T> | false): Promise<T> {
  if (result && typeof (result as Promise<T>).then === 'function') {
    return result as Promise<T>
  }

  return result === false
    ? Promise.reject(new Error('operation failed'))
    : Promise.resolve(result as T)
}
