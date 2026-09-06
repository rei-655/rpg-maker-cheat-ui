import { defineStore } from 'pinia'
import { settings } from '@/engine/storage'

export interface TableView {
  search: string
  sort: { key: string | null; desc: boolean }
  page: number
  perPage: number
  widths: Record<string, number>
  flags: Record<string, boolean>
  tab: string
}

export interface Geometry {
  left: number
  top: number
  width: number
  height: number
}

const MIN = { width: 680, height: 440 }
const DEFAULT = { width: 1000, height: 700 }
const MARGIN = 24

function defaultView(): TableView {
  return {
    search: '',
    sort: { key: 'id', desc: false },
    page: 1,
    perPage: 25,
    widths: {},
    flags: {},
    tab: ''
  }
}

export const useSession = defineStore('session', {
  state: () => ({
    open: false,
    panelId: 'home',
    dimmed: false,
    geometry: settings.get<Geometry | null>('geometry', null),
    views: {} as Record<string, TableView>
  }),

  actions: {
    show(panelId?: string) {
      if (panelId) this.panelId = panelId
      this.open = true
    },

    hide() {
      this.open = false
    },

    toggle(panelId?: string) {
      const changed = panelId != null && panelId !== this.panelId

      if (panelId) this.panelId = panelId
      this.open = this.open ? changed : true
    },

    /** パネルごとの表示状態。タブを移動しても検索条件が残る。 */
    view(key: string, overrides: Partial<TableView> = {}): TableView {
      this.views[key] ??= { ...defaultView(), ...overrides }
      return this.views[key]!
    },

    fitToScreen(geometry: Geometry): Geometry {
      const width = Math.max(MIN.width, Math.min(geometry.width, innerWidth - MARGIN))
      const height = Math.max(MIN.height, Math.min(geometry.height, innerHeight - MARGIN))

      return {
        width,
        height,
        left: Math.max(0, Math.min(geometry.left, innerWidth - width)),
        top: Math.max(0, Math.min(geometry.top, innerHeight - height))
      }
    },

    centeredGeometry(): Geometry {
      const width = Math.min(DEFAULT.width, innerWidth - MARGIN * 2)
      const height = Math.min(DEFAULT.height, innerHeight - MARGIN * 2)

      return {
        width,
        height,
        left: Math.max(MARGIN, Math.round((innerWidth - width) / 2)),
        top: Math.max(MARGIN, Math.round((innerHeight - height) / 2))
      }
    },

    setGeometry(geometry: Geometry) {
      this.geometry = this.fitToScreen(geometry)
      settings.set('geometry', this.geometry)
    },

    resetGeometry() {
      this.setGeometry(this.centeredGeometry())
    }
  }
})
