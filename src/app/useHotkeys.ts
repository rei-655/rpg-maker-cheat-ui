import { onBeforeUnmount, onMounted } from 'vue'
import { comboFrom, isCapturingKeys, isModifierKey } from './keys'
import { useShortcuts } from '@/stores/shortcuts'
import { isTypingInUi } from '@/engine/input'
import { safely } from '@/engine/safety'
import type { ActionSpec } from './actions'

/**
 * キャプチャ段階で受ける。ウィンドウ内の入力欄はキーをゲームに渡さないために
 * 伝播を止めており、そのせいで閉じるショートカットまで届かなくなっていた。
 * 入力中に発火するのは essential な動作だけ。
 *
 * window のリスナーで投げた例外はツクールのエラー画面になる。動作は境界の内側で走らせる。
 */
export function useHotkeys(): void {
  const shortcuts = useShortcuts()
  const held = new Map<string, ActionSpec>()

  function onKeydown(event: KeyboardEvent): void {
    // 割り当て中のキーは、すでに何かに割り当てられていても割り当て欄へ渡す
    if (isCapturingKeys(event)) return

    const combo = comboFrom(event)
    if (!combo || event.repeat) return

    const action = shortcuts.resolve(combo)
    if (!action || (isTypingInUi() && !action.essential)) return

    event.preventDefault()
    event.stopImmediatePropagation()

    safely(`running ${action.id}`, () => action.run(shortcuts.binding(action.id).slot))
    if (action.release) held.set(combo, action)
  }

  function onKeyup(event: KeyboardEvent): void {
    if (held.size === 0) return

    for (const [combo, action] of held) {
      const key = combo.slice(combo.lastIndexOf('+') + 1)

      if (key === event.code || isModifierKey(event.code)) release(combo, action)
    }
  }

  /** フォーカスが外れると keyup は届かない。押しっぱなしの動作が止まらなくなる。 */
  function releaseAll(): void {
    for (const [combo, action] of held) release(combo, action)
  }

  function release(combo: string, action: ActionSpec): void {
    held.delete(combo)
    safely(`releasing ${action.id}`, () => action.release?.())
  }

  onMounted(() => {
    addEventListener('keydown', onKeydown, true)
    addEventListener('keyup', onKeyup, true)
    addEventListener('blur', releaseAll)
  })

  onBeforeUnmount(() => {
    removeEventListener('keydown', onKeydown, true)
    removeEventListener('keyup', onKeyup, true)
    removeEventListener('blur', releaseAll)
    releaseAll()
  })
}
