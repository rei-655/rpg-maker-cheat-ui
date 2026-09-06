<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import { wallet } from '@/engine/cheats'
import { currentMapId, has, partyMembers, player } from '@/engine/globals'
import { mapName } from '@/engine/maps'
import { watcher } from '@/features/unstuck/watcher'
import { t } from '@/i18n'

const state = reactive({ gold: 0, party: 0, map: '', x: 0, y: 0, recording: false, changed: 0 })

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  read()
  timer = setInterval(read, 1000)
})

onBeforeUnmount(() => clearInterval(timer))

/** 常に見えているので、開いている画面に関係なく現在値を出す。 */
function read(): void {
  state.gold = wallet.gold()
  state.party = partyMembers().length
  state.map = mapName(currentMapId())
  state.x = has('$gamePlayer') ? player().x : 0
  state.y = has('$gamePlayer') ? player().y : 0
  state.recording = watcher.recording
  state.changed = watcher.recording ? watcher.diff().length : 0
}
</script>

<template>
  <div class="statusbar">
    <span class="statusbar__item">
      <span class="statusbar__label">{{ t('bar.gold') }}</span>
      <span class="mono">{{ state.gold.toLocaleString() }}</span>
    </span>
    <span class="statusbar__item">
      <span class="statusbar__label">{{ t('bar.party') }}</span>
      <span class="mono">{{ state.party }}</span>
    </span>
    <span class="statusbar__item">
      <span class="statusbar__label">{{ t('bar.map') }}</span>
      <span>{{ state.map || t('common.unknown') }}</span>
      <span class="mono faint">{{ state.x }}, {{ state.y }}</span>
    </span>
    <span class="spacer" />
    <span v-if="state.recording" class="status">
      <span class="dot dot-warn" />
      {{ t('bar.recording', { count: state.changed }) }}
    </span>
  </div>
</template>
