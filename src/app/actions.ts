import { battle, encounters, movement, scenes } from '@/engine/cheats'
import { partyMembers, troopMembers } from '@/engine/globals'
import { isNwjs } from '@/engine/engine'
import { messageSkip } from '@/engine/messages'
import { toast } from '@/shared/composables/useToast'
import { t, type MessageKey } from '@/i18n'

export interface ActionSpec {
  id: string
  labelKey: MessageKey
  hintKey?: MessageKey
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
    labelKey: 'action.toggleWindow',
    hintKey: 'action.toggleWindow.hint',
    essential: true,
    defaultCombo: 'ctrl+KeyC',
    run: () => ui.toggleWindow()
  },
  {
    id: 'openTravel',
    labelKey: 'action.openTravel',
    defaultCombo: 'ctrl+KeyM',
    run: () => ui.openWindow('travel')
  },
  {
    id: 'openUnstuck',
    labelKey: 'action.openUnstuck',
    defaultCombo: 'ctrl+KeyU',
    run: () => ui.openWindow('unstuck')
  },
  {
    id: 'quickSave',
    labelKey: 'action.quickSave',
    slot: 1,
    defaultCombo: 'ctrl+KeyS',
    run: (slot) =>
      scenes
        .quickSave(slot)
        .then(() => toast.success(t('toast.saved', { slot })))
        .catch((error: unknown) => toast.error(t('toast.saveFailed', { slot }), error))
  },
  {
    id: 'quickLoad',
    labelKey: 'action.quickLoad',
    slot: 1,
    defaultCombo: 'ctrl+KeyQ',
    run: (slot) =>
      scenes
        .quickLoad(slot)
        .then(() => toast.success(t('toast.loaded', { slot })))
        .catch((error: unknown) => toast.error(t('toast.loadFailed', { slot }), error))
  },
  {
    id: 'openSaveScene',
    labelKey: 'action.openSaveScene',
    defaultCombo: 'ctrl+BracketLeft',
    run: () => scenes.toggleSave()
  },
  {
    id: 'openLoadScene',
    labelKey: 'action.openLoadScene',
    defaultCombo: 'ctrl+BracketRight',
    run: () => scenes.toggleLoad()
  },
  { id: 'toTitle', labelKey: 'action.toTitle', defaultCombo: 'ctrl+KeyT', run: () => scenes.toTitle() },
  { id: 'forceVictory', labelKey: 'action.forceVictory', defaultCombo: 'ctrl+KeyV', run: () => finish('victory') },
  { id: 'forceDefeat', labelKey: 'action.forceDefeat', defaultCombo: 'ctrl+KeyD', run: () => finish('defeat') },
  { id: 'forceEscape', labelKey: 'action.forceEscape', defaultCombo: 'ctrl+KeyE', run: () => finish('escape') },
  {
    id: 'toggleNoClip',
    labelKey: 'action.toggleNoClip',
    defaultCombo: 'alt+KeyW',
    run: () => toast.info(t('toast.noClip', { state: t(movement.toggleNoClip() ? 'common.on' : 'common.off') }))
  },
  {
    id: 'toggleEncounters',
    labelKey: 'action.toggleEncounters',
    defaultCombo: 'alt+KeyR',
    run: () =>
      toast.info(
        t('toast.encounters', {
          state: t(encounters.toggle() ? 'toast.encountersOff' : 'toast.encountersOn')
        })
      )
  },
  {
    id: 'enemyWound',
    labelKey: 'action.enemyWound',
    defaultCombo: 'alt+Digit1',
    run: () => bulk(() => battle.setHpAll(troopMembers(), 1), 'action.enemyWound')
  },
  {
    id: 'enemyRecover',
    labelKey: 'action.enemyRecover',
    defaultCombo: 'alt+Digit0',
    run: () => bulk(() => battle.recoverAll(troopMembers()), 'action.enemyRecover')
  },
  {
    id: 'partyWound',
    labelKey: 'action.partyWound',
    defaultCombo: 'alt+Digit2',
    run: () => bulk(() => battle.setHpAll(partyMembers(), 1), 'action.partyWound')
  },
  {
    id: 'partyRecover',
    labelKey: 'action.partyRecover',
    defaultCombo: 'alt+Digit9',
    run: () => bulk(() => battle.recoverAll(partyMembers()), 'action.partyRecover')
  },
  {
    id: 'skipMessage',
    labelKey: 'action.skipMessage',
    hintKey: 'action.skipMessage.hint',
    defaultCombo: '',
    run: () => messageSkip.start(),
    release: () => messageSkip.stop()
  },
  {
    id: 'devTools',
    labelKey: 'action.devTools',
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
  if (battle.finish(kind)) toast.success(t('combat.finished', { kind: t(`combat.${kind}`) }))
  else toast.warn(t('toast.onlyInBattle'))
}

function bulk(run: () => void, key: MessageKey): void {
  run()
  toast.success(t(key))
}
