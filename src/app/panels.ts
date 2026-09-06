import type { Component } from 'vue'
import type { IconName } from '@/shared/ui/icons'
import type { MessageKey } from '@/i18n'

import HomePanel from '@/features/home/HomePanel.vue'
import BattlePanel from '@/features/battle/BattlePanel.vue'
import StatusPanel from '@/features/status/StatusPanel.vue'
import StatesPanel from '@/features/states/StatesPanel.vue'
import ItemsPanel from '@/features/items/ItemsPanel.vue'
import VariablesPanel from '@/features/variables/VariablesPanel.vue'
import SwitchesPanel from '@/features/switches/SwitchesPanel.vue'
import LocationsPanel from '@/features/locations/LocationsPanel.vue'
import SettingsPanel from '@/features/settings/SettingsPanel.vue'

export interface PanelSpec {
  id: string
  label: string
  icon: IconName
  hintKey: MessageKey
  component: Component
  onHome?: boolean
}

export const PANELS: PanelSpec[] = [
  { id: 'home', label: 'Index', icon: 'home', hintKey: 'nav.home.hint', component: HomePanel, onHome: false },
  { id: 'battle', label: 'Battle', icon: 'battle', hintKey: 'nav.battle.hint', component: BattlePanel },
  { id: 'status', label: 'Status', icon: 'status', hintKey: 'nav.status.hint', component: StatusPanel },
  { id: 'states', label: 'States', icon: 'states', hintKey: 'nav.states.hint', component: StatesPanel },
  { id: 'items', label: 'Items', icon: 'items', hintKey: 'nav.items.hint', component: ItemsPanel },
  { id: 'variables', label: 'Variables', icon: 'variables', hintKey: 'nav.variables.hint', component: VariablesPanel },
  { id: 'switches', label: 'Switches', icon: 'switches', hintKey: 'nav.switches.hint', component: SwitchesPanel },
  { id: 'locations', label: 'Locations', icon: 'locations', hintKey: 'nav.locations.hint', component: LocationsPanel },
  { id: 'settings', label: 'Settings', icon: 'settings', hintKey: 'nav.settings.hint', component: SettingsPanel }
]

export const DEFAULT_PANEL = 'home'

export const findPanel = (id: string): PanelSpec =>
  PANELS.find((panel) => panel.id === id) ?? PANELS[0]!

export const homeCards = (): PanelSpec[] => PANELS.filter((panel) => panel.onHome !== false)
