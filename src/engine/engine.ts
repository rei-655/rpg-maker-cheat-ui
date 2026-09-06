import { has, rpg } from './globals'
import type { EngineName } from './types'

export function engineName(): EngineName {
  return has('Utils') && rpg('Utils').RPGMAKER_NAME === 'MV' ? 'MV' : 'MZ'
}

export const isMV = () => engineName() === 'MV'

export function isNwjs(): boolean {
  return has('Utils') && rpg('Utils').isNwjs()
}

/** MV は www/ 配下、MZ はプロジェクト直下にゲームデータを置く。 */
export function settingsDir(): string {
  return `${isMV() ? './www' : '.'}/cheat-settings`
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
