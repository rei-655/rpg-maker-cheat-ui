/**
 * ゲームを巻き込まないための境界。
 *
 * この UI はゲームのページに間借りしている。こちらの都合で投げた例外は
 * ツクールのエラー画面になり、遊んでいる側から見ればゲームが落ちる。実際、
 * 組み込みの Object.prototype.hasOwnProperty が壊れているゲームがあり、
 * 起動しただけでそうなった。
 *
 * ゲームのコードに差し込む場所と、ゲームが呼び返してくる場所は、すべて
 * ここを通す。握りつぶした内容はコンソールに残す。
 */
const TAG = '[cheat ui]'

export function safely<T>(what: string, run: () => T): T | undefined {
  try {
    return run()
  } catch (error) {
    console.warn(`${TAG} ${what} failed; the game is unaffected`, error)
    return undefined
  }
}

/** ゲームから呼ばれる関数を包む。中で投げてもゲームには伝わらない。 */
export function guarded<A extends unknown[]>(what: string, run: (...args: A) => void) {
  return (...args: A): void => {
    safely(what, () => run(...args))
  }
}
