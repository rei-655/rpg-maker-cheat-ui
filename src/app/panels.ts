import type { Component } from 'vue'
import type { IconName } from '@/shared/ui/icons'

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
  hint: string
  component: Component
  onHome?: boolean
}

export const PANELS: PanelSpec[] = [
  { id: 'home', label: 'Index', icon: 'home', hint: '현재 상태 요약과 빠른 이동', component: HomePanel, onHome: false },
  { id: 'battle', label: 'Battle', icon: 'battle', hint: '인카운터 · 전투 종료 · HP/MP/TP', component: BattlePanel },
  { id: 'status', label: 'Status', icon: 'status', hint: '레벨 · 경험치 · 능력치 · 무적', component: StatusPanel },
  { id: 'states', label: 'States', icon: 'states', hint: '상태이상과 버프 부여 · 해제', component: StatesPanel },
  { id: 'items', label: 'Items', icon: 'items', hint: '아이템 · 무기 · 방어구 수량', component: ItemsPanel },
  { id: 'variables', label: 'Variables', icon: 'variables', hint: '변수 검색 · 값 편집 · 값 스캔', component: VariablesPanel },
  { id: 'switches', label: 'Switches', icon: 'switches', hint: '스위치 on · off', component: SwitchesPanel },
  { id: 'locations', label: 'Locations', icon: 'locations', hint: '맵 이동과 저장해 둔 위치', component: LocationsPanel },
  { id: 'settings', label: 'Settings', icon: 'settings', hint: '단축키와 창 설정', component: SettingsPanel }
]

export const DEFAULT_PANEL = 'home'

export const findPanel = (id: string): PanelSpec =>
  PANELS.find((panel) => panel.id === id) ?? PANELS[0]!

export const homeCards = (): PanelSpec[] => PANELS.filter((panel) => panel.onHome !== false)
