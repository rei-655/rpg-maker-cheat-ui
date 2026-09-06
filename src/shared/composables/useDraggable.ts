import { onBeforeUnmount, ref } from 'vue'
import type { Geometry } from '@/stores/session'

type Mode = 'move' | 'resize'

/** タイトルバーで移動、右下でリサイズ。 */
export function useDraggable(get: () => Geometry, set: (value: Geometry) => void) {
  const drag = ref<{ mode: Mode; x: number; y: number; origin: Geometry } | null>(null)

  function begin(mode: Mode, event: MouseEvent): void {
    if (event.button !== 0) return

    event.preventDefault()
    drag.value = { mode, x: event.clientX, y: event.clientY, origin: { ...get() } }

    addEventListener('mousemove', onMove)
    addEventListener('mouseup', end)
  }

  function onMove(event: MouseEvent): void {
    if (!drag.value) return

    const { mode, origin } = drag.value
    const dx = event.clientX - drag.value.x
    const dy = event.clientY - drag.value.y

    set(
      mode === 'move'
        ? { ...origin, left: origin.left + dx, top: origin.top + dy }
        : { ...origin, width: origin.width + dx, height: origin.height + dy }
    )
  }

  function end(): void {
    drag.value = null
    removeEventListener('mousemove', onMove)
    removeEventListener('mouseup', end)
  }

  onBeforeUnmount(end)

  return { startMove: (event: MouseEvent) => begin('move', event), startResize: (event: MouseEvent) => begin('resize', event) }
}
