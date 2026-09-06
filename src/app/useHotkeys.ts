import { onBeforeUnmount, onMounted } from 'vue'
import { comboFrom } from './keys'
import { useShortcuts } from '@/stores/shortcuts'
import { isTypingInUi } from '@/engine/input'
import type { ActionSpec } from './actions'

/**
 * キャプチャ段階で受ける。ウィンドウ内の入力欄はキーをゲームに渡さないために
 * 伝播を止めており、そのせいで閉じるショートカットまで届かなくなっていた。
 * 入力中に発火するのは essential な動作だけ。
 */
export function useHotkeys(): void {
  const shortcuts = useShortcuts()
  const held = new Map<string, ActionSpec>()

  function onKeydown(event: KeyboardEvent): void {
    const combo = comboFrom(event)
    if (!combo || event.repeat) return

    const action = shortcuts.resolve(combo)
    if (!action || (isTypingInUi() && !action.essential)) return

    event.preventDefault()
    event.stopImmediatePropagation()

    action.run(shortcuts.binding(action.id).slot)
    if (action.release) held.set(combo, action)
  }

  function onKeyup(event: KeyboardEvent): void {
    if (held.size === 0) return

    for (const [combo, action] of held) {
      if (combo.endsWith(event.code) || /^(Control|Alt|Shift|Meta)/.test(event.code)) {
        action.release?.()
        held.delete(combo)
      }
    }
  }

  onMounted(() => {
    addEventListener('keydown', onKeydown, true)
    addEventListener('keyup', onKeyup, true)
  })

  onBeforeUnmount(() => {
    removeEventListener('keydown', onKeydown, true)
    removeEventListener('keyup', onKeyup, true)
  })
}
