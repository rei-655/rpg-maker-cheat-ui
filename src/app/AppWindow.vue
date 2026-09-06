<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import { PANELS, findPanel } from './panels'
import { formatCombo } from './keys'
import { useSession } from '@/stores/session'
import { useShortcuts } from '@/stores/shortcuts'
import { useDraggable } from '@/shared/composables/useDraggable'

const session = useSession()
const shortcuts = useShortcuts()

const panel = computed(() => findPanel(session.panelId))
const geometry = computed(() => session.geometry ?? session.centeredGeometry())

const closeHint = computed(() => {
  const combo = shortcuts.binding('toggleWindow').combo
  return combo ? `${formatCombo(combo)} 닫기` : ''
})

const { startMove, startResize } = useDraggable(
  () => geometry.value,
  (value) => session.setGeometry(value)
)

onMounted(() => {
  session.setGeometry(geometry.value)
  addEventListener('resize', clamp)
})

onBeforeUnmount(() => removeEventListener('resize', clamp))

function clamp(): void {
  session.setGeometry(geometry.value)
}
</script>

<template>
  <div
    class="window"
    :class="{ 'window--dim': session.dimmed }"
    :style="{
      left: `${geometry.left}px`,
      top: `${geometry.top}px`,
      width: `${geometry.width}px`,
      height: `${geometry.height}px`
    }"
  >
    <div class="titlebar" @mousedown="startMove">
      <span class="titlebar__grip"><AppIcon name="grip" :size="15" /></span>
      <span class="titlebar__crumb">Cheat · <b>{{ panel.label }}</b></span>
      <span class="spacer" />
      <span v-if="closeHint" class="titlebar__hint">{{ closeHint }}</span>
      <button
        class="btn btn--sm btn--icon btn--ghost"
        :title="session.dimmed ? '불투명하게' : '흐리게'"
        @mousedown.stop
        @click="session.dimmed = !session.dimmed"
      >
        <AppIcon :name="session.dimmed ? 'eyeOff' : 'eye'" :size="14" />
      </button>
      <button
        class="btn btn--sm btn--icon btn--ghost"
        title="창 위치 초기화"
        @mousedown.stop
        @click="session.resetGeometry()"
      >
        <AppIcon name="reset" :size="14" />
      </button>
      <button class="btn btn--sm btn--icon btn--ghost" title="닫기" @mousedown.stop @click="session.hide()">
        <AppIcon name="close" :size="14" />
      </button>
    </div>

    <div class="window__body">
      <nav class="nav">
        <button
          v-for="entry in PANELS"
          :key="entry.id"
          class="nav__item"
          :class="{ 'nav__item--active': entry.id === panel.id }"
          @click="session.panelId = entry.id"
        >
          <AppIcon :name="entry.icon" :size="15" />
          <span>{{ entry.label }}</span>
        </button>
      </nav>

      <section class="content">
        <component :is="panel.component" />
      </section>
    </div>

    <div class="window__resize" @mousedown="startResize" />
  </div>
</template>
