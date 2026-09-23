import { defineStore } from 'pinia'
import { add, load, remove, rename, resolveAll, saved, writeWatch, type Target, type Watch, type WatchRow } from '@/features/data/watchlist'

/**
 * 保存した値は「値を探す」画面とホームの両方に出る。どちらで消しても
 * もう一方に伝わる必要があるので、状態は一箇所に置く。
 *
 * 表示用の行はゲームの値を読んだ結果なので、勝手には更新されない。
 * 画面を開いたときと書き込んだあとに refresh() で読み直す。
 */
export const useWatches = defineStore('watches', {
  state: () => ({
    entries: load() as Watch[],
    rows: [] as WatchRow[]
  }),

  actions: {
    refresh() {
      this.rows = resolveAll(this.entries)
    },

    keep(target: Target): boolean {
      const before = this.entries.length
      this.entries = add(this.entries, target)
      this.refresh()

      return this.entries.length > before
    },

    drop(key: string) {
      this.entries = remove(this.entries, key)
      this.refresh()
    },

    setName(key: string, name: string) {
      this.entries = rename(this.entries, key, name)
      this.refresh()
    },

    commit(entry: Watch, raw: string): boolean {
      const ok = writeWatch(entry, raw)
      this.refresh()

      return ok
    },

    isSaved(ref: string): boolean {
      return saved(this.entries, ref)
    }
  }
})
