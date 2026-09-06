import { defineStore } from 'pinia'
import { ACTIONS, findAction, type ActionSpec } from '@/app/actions'
import { JsonStore } from '@/engine/storage'
import { t } from '@/i18n'

export interface Binding {
  combo: string
  slot: number
}

// 旧版のチート UI も shortcuts.json を使う。混ざらないよう名前を分ける。
const store = new JsonStore('keys.json')
const KEY = 'bindings'

function defaults(): Record<string, Binding> {
  const bindings: Record<string, Binding> = {}

  for (const action of ACTIONS) {
    bindings[action.id] = { combo: action.defaultCombo, slot: action.slot ?? 1 }
  }

  return bindings
}

export const useShortcuts = defineStore('shortcuts', {
  state: () => ({
    bindings: { ...defaults(), ...store.get<Record<string, Binding>>(KEY, {}) }
  }),

  getters: {
    byCombo(state): Map<string, ActionSpec> {
      const map = new Map<string, ActionSpec>()

      for (const [id, binding] of Object.entries(state.bindings)) {
        const action = findAction(id)
        if (action && binding.combo) map.set(binding.combo, action)
      }

      return map
    }
  },

  actions: {
    binding(id: string): Binding {
      this.bindings[id] ??= { combo: '', slot: 1 }
      return this.bindings[id]!
    },

    resolve(combo: string): ActionSpec | undefined {
      return this.byCombo.get(combo)
    },

    /** @returns 失敗時はエラーメッセージ、成功時は null。 */
    rebind(id: string, combo: string): string | null {
      const taken = combo ? this.byCombo.get(combo) : undefined

      if (taken && taken.id !== id) return t('keys.conflict', { label: t(taken.labelKey) })

      this.binding(id).combo = combo
      this.persist()
      return null
    },

    setSlot(id: string, slot: number): void {
      this.binding(id).slot = slot
      this.persist()
    },

    restoreDefaults(): void {
      this.bindings = defaults()
      this.persist()
    },

    persist(): void {
      store.set(KEY, this.bindings)
    }
  }
})
