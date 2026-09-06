<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import StatusBar from './StatusBar.vue'
import { GROUPS, findPanel, panelsOf } from './panels'
import { formatCombo } from './keys'
import { useSession } from '@/stores/session'
import { useShortcuts } from '@/stores/shortcuts'
import { useDraggable } from '@/shared/composables/useDraggable'
import { t } from '@/i18n'

const session = useSession()
const shortcuts = useShortcuts()

const panel = computed(() => findPanel(session.panelId))
const geometry = computed(() => session.geometry ?? session.centeredGeometry())

const closeHint = computed(() => {
  const combo = shortcuts.binding('toggleWindow').combo
  return combo ? t('window.closeHint', { key: formatCombo(combo) }) : ''
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
      <span class="titlebar__crumb"><b>{{ t(panel.labelKey) }}</b> · {{ t(panel.hintKey) }}</span>
      <span class="spacer" />
      <span v-if="closeHint" class="titlebar__hint">{{ closeHint }}</span>
      <button
        class="btn btn--sm btn--icon btn--ghost"
        :title="session.dimmed ? t('window.undim') : t('window.dim')"
        @mousedown.stop
        @click="session.dimmed = !session.dimmed"
      >
        <AppIcon :name="session.dimmed ? 'eyeOff' : 'eye'" :size="14" />
      </button>
      <button
        class="btn btn--sm btn--icon btn--ghost"
        :title="t('window.resetGeometry')"
        @mousedown.stop
        @click="session.resetGeometry()"
      >
        <AppIcon name="reset" :size="14" />
      </button>
      <button class="btn btn--sm btn--icon btn--ghost" :title="t('common.close')" @mousedown.stop @click="session.hide()">
        <AppIcon name="close" :size="14" />
      </button>
    </div>

    <div class="window__body">
      <nav class="nav">
        <template v-for="group in GROUPS" :key="group.id">
          <div class="nav__group">{{ t(group.labelKey) }}</div>
          <button
            v-for="entry in panelsOf(group.id)"
            :key="entry.id"
            class="nav__item"
            :class="{ 'nav__item--active': entry.id === panel.id }"
            :title="t(entry.hintKey)"
            @click="session.panelId = entry.id"
          >
            <AppIcon :name="entry.icon" :size="15" />
            <span>{{ t(entry.labelKey) }}</span>
          </button>
        </template>
      </nav>

      <section class="content">
        <component :is="panel.component" />
      </section>
    </div>

    <StatusBar />
    <div class="window__resize" @mousedown="startResize" />
  </div>
</template>
