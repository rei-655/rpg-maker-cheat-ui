import { isNwjs, settingsFile } from './engine'
import { root } from './root'

type Json = Record<string, unknown>

const store = () => root.localStorage as Storage | undefined

interface NodeFs {
  existsSync(path: string): boolean
  readFileSync(path: string, encoding: string): string
  writeFileSync(path: string, data: string): void
  mkdirSync(path: string, options: { recursive: boolean }): void
  unlinkSync(path: string): void
}

function nodeFs(): { fs: NodeFs; dirname(path: string): string } | null {
  if (!isNwjs() || typeof require !== 'function') return null

  return { fs: require('fs') as NodeFs, dirname: (require('path') as { dirname(p: string): string }).dirname }
}

/**
 * cheat-settings/ 配下の JSON ファイル。ブラウザでは localStorage を使う。
 * 壊れたファイルは既定値に落とし、プラグイン全体を止めない。
 */
export class JsonStore {
  private readonly path: string

  constructor(fileName: string) {
    this.path = settingsFile(fileName)
  }

  read(): Json {
    const node = nodeFs()

    if (!node) {
      const raw = store()?.getItem(this.path)
      return raw ? safeParse(raw) : {}
    }

    try {
      return node.fs.existsSync(this.path) ? safeParse(node.fs.readFileSync(this.path, 'utf-8')) : {}
    } catch (error) {
      console.warn(`[cheat ui] cannot read ${this.path}`, error)
      return {}
    }
  }

  write(data: Json): void {
    const node = nodeFs()

    if (!node) {
      store()?.setItem(this.path, JSON.stringify(data))
      return
    }

    try {
      const parent = node.dirname(this.path)
      if (!node.fs.existsSync(parent)) node.fs.mkdirSync(parent, { recursive: true })

      node.fs.writeFileSync(this.path, JSON.stringify(data, null, 2))
    } catch (error) {
      console.warn(`[cheat ui] cannot write ${this.path}`, error)
    }
  }

  get<T>(key: string, fallback: T): T {
    const value = this.read()[key]
    return value === undefined ? fallback : (value as T)
  }

  set(key: string, value: unknown): void {
    this.write({ ...this.read(), [key]: value })
  }

  remove(): void {
    const node = nodeFs()

    if (!node) {
      store()?.removeItem(this.path)
      return
    }

    try {
      node.fs.unlinkSync(this.path)
    } catch {
      // すでに無い
    }
  }
}

function safeParse(raw: string): Json {
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Json) : {}
  } catch {
    return {}
  }
}

export const settings = new JsonStore('ui.json')
