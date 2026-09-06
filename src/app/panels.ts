import type { Component } from 'vue'
import type { IconName } from '@/shared/ui/icons'
import type { MessageKey } from '@/i18n'

import HomePanel from '@/features/home/HomePanel.vue'
import PartyPanel from '@/features/party/PartyPanel.vue'
import InventoryPanel from '@/features/inventory/InventoryPanel.vue'
import CombatPanel from '@/features/combat/CombatPanel.vue'
import UnstuckPanel from '@/features/unstuck/UnstuckPanel.vue'
import DataPanel from '@/features/data/DataPanel.vue'
import TravelPanel from '@/features/travel/TravelPanel.vue'
import SettingsPanel from '@/features/settings/SettingsPanel.vue'

export type PanelGroup = 'now' | 'progress' | 'tool'

export interface PanelSpec {
  id: string
  group: PanelGroup
  labelKey: MessageKey
  hintKey: MessageKey
  icon: IconName
  component: Component
  onHome?: boolean
}

/** 画面は「何をしたいか」で並べる。エンジンの内部構造は表に出さない。 */
export const PANELS: PanelSpec[] = [
  { id: 'home', group: 'now', labelKey: 'nav.home', hintKey: 'nav.home.hint', icon: 'home', component: HomePanel, onHome: false },
  { id: 'party', group: 'now', labelKey: 'nav.party', hintKey: 'nav.party.hint', icon: 'status', component: PartyPanel },
  { id: 'inventory', group: 'now', labelKey: 'nav.inventory', hintKey: 'nav.inventory.hint', icon: 'items', component: InventoryPanel },
  { id: 'combat', group: 'progress', labelKey: 'nav.combat', hintKey: 'nav.combat.hint', icon: 'battle', component: CombatPanel },
  { id: 'unstuck', group: 'progress', labelKey: 'nav.unstuck', hintKey: 'nav.unstuck.hint', icon: 'target', component: UnstuckPanel },
  { id: 'data', group: 'progress', labelKey: 'nav.data', hintKey: 'nav.data.hint', icon: 'variables', component: DataPanel },
  { id: 'travel', group: 'progress', labelKey: 'nav.travel', hintKey: 'nav.travel.hint', icon: 'locations', component: TravelPanel },
  { id: 'settings', group: 'tool', labelKey: 'nav.settings', hintKey: 'nav.settings.hint', icon: 'settings', component: SettingsPanel }
]

export const GROUPS: { id: PanelGroup; labelKey: MessageKey }[] = [
  { id: 'now', labelKey: 'nav.group.now' },
  { id: 'progress', labelKey: 'nav.group.progress' },
  { id: 'tool', labelKey: 'nav.group.tool' }
]

export const DEFAULT_PANEL = 'home'

export const findPanel = (id: string): PanelSpec => PANELS.find((panel) => panel.id === id) ?? PANELS[0]!

export const panelsOf = (group: PanelGroup): PanelSpec[] => PANELS.filter((panel) => panel.group === group)

export const homeCards = (): PanelSpec[] => PANELS.filter((panel) => panel.onHome !== false)
