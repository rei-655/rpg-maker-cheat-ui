import { battle, encounters, movement, scenes } from '@/engine/cheats'
import { partyMembers, troopMembers } from '@/engine/globals'
import { isNwjs } from '@/engine/engine'
import { messageSkip } from '@/engine/messages'
import { toast } from '@/shared/composables/useToast'

export interface ActionSpec {
  id: string
  label: string
  hint?: string
  essential?: boolean
  slot?: number
  defaultCombo: string
  run(slot: number): void
  release?(): void
}

/** 開くパネル。App が差し込むので、ここはコンポーネントに依存しない。 */
export const ui: {
  toggleWindow(panelId?: string): void
  openWindow(panelId: string): void
} = {
  toggleWindow: () => {},
  openWindow: () => {}
}

export const ACTIONS: ActionSpec[] = [
  {
    id: 'toggleWindow',
    label: '치트 창 열기 · 닫기',
    hint: '입력 중에도 동작합니다',
    essential: true,
    defaultCombo: 'ctrl+KeyC',
    run: () => ui.toggleWindow()
  },
  {
    id: 'openLocations',
    label: 'Locations 열기',
    defaultCombo: 'ctrl+KeyM',
    run: () => ui.openWindow('locations')
  },
  {
    id: 'quickSave',
    label: '빠른 저장',
    slot: 1,
    defaultCombo: 'ctrl+KeyS',
    run: (slot) =>
      scenes
        .quickSave(slot)
        .then(() => toast.success(`슬롯 ${slot} 에 저장했다`))
        .catch((error: unknown) => toast.error(`슬롯 ${slot} 저장 실패`, error))
  },
  {
    id: 'quickLoad',
    label: '빠른 불러오기',
    slot: 1,
    defaultCombo: 'ctrl+KeyQ',
    run: (slot) =>
      scenes
        .quickLoad(slot)
        .then(() => toast.success(`슬롯 ${slot} 을 불러왔다`))
        .catch((error: unknown) => toast.error(`슬롯 ${slot} 불러오기 실패`, error))
  },
  { id: 'openSaveScene', label: '저장 화면', defaultCombo: 'ctrl+BracketLeft', run: () => scenes.toggleSave() },
  { id: 'openLoadScene', label: '불러오기 화면', defaultCombo: 'ctrl+BracketRight', run: () => scenes.toggleLoad() },
  { id: 'toTitle', label: '타이틀로', defaultCombo: 'ctrl+KeyT', run: () => scenes.toTitle() },
  { id: 'forceVictory', label: '전투 강제 승리', defaultCombo: 'ctrl+KeyV', run: () => finish('victory') },
  { id: 'forceDefeat', label: '전투 강제 패배', defaultCombo: 'ctrl+KeyD', run: () => finish('defeat') },
  { id: 'forceEscape', label: '전투 강제 도주', defaultCombo: 'ctrl+KeyE', run: () => finish('escape') },
  {
    id: 'toggleNoClip',
    label: '벽 통과',
    defaultCombo: 'alt+KeyW',
    run: () => toast.info(`벽 통과 ${movement.toggleNoClip() ? 'ON' : 'OFF'}`)
  },
  {
    id: 'toggleEncounters',
    label: '랜덤 인카운터 정지',
    defaultCombo: 'alt+KeyR',
    run: () => toast.info(`인카운터 ${encounters.toggle() ? '정지' : '재개'}`)
  },
  {
    id: 'enemyWound',
    label: '적 전체 HP 1',
    defaultCombo: 'alt+Digit1',
    run: () => bulk(() => battle.setHpAll(troopMembers(), 1), '적 전체 HP 1')
  },
  {
    id: 'enemyRecover',
    label: '적 전체 회복',
    defaultCombo: 'alt+Digit0',
    run: () => bulk(() => battle.recoverAll(troopMembers()), '적 전체 회복')
  },
  {
    id: 'partyWound',
    label: '아군 전체 HP 1',
    defaultCombo: 'alt+Digit2',
    run: () => bulk(() => battle.setHpAll(partyMembers(), 1), '아군 전체 HP 1')
  },
  {
    id: 'partyRecover',
    label: '아군 전체 회복',
    defaultCombo: 'alt+Digit9',
    run: () => bulk(() => battle.recoverAll(partyMembers()), '아군 전체 회복')
  },
  {
    id: 'skipMessage',
    label: '메시지 빨리 넘기기',
    hint: '누르고 있는 동안',
    defaultCombo: '',
    run: () => messageSkip.start(),
    release: () => messageSkip.stop()
  },
  {
    id: 'devTools',
    label: '개발자 도구',
    defaultCombo: 'F12',
    run: () => {
      if (isNwjs()) (require('nw.gui') as { Window: { get(): { showDevTools(): void } } }).Window.get().showDevTools()
    }
  }
]

export function findAction(id: string): ActionSpec | undefined {
  return ACTIONS.find((action) => action.id === id)
}

function finish(kind: 'victory' | 'defeat' | 'escape'): void {
  if (battle.finish(kind)) toast.success(`전투 ${kind}`)
  else toast.warn('전투 중에만 사용할 수 있다')
}

function bulk(run: () => void, message: string): void {
  run()
  toast.success(message)
}
