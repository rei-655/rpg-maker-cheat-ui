<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { switches, variables } from '@/engine/globals'
import { toInt } from '@/shared/lib/coerce'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { t } from '@/i18n'
import { watcher, type Change } from './watcher'

const columns = computed<Column[]>(() => [
  { key: 'kind', label: t('col.kind'), width: 96, sortable: false },
  { key: 'id', label: t('col.id'), width: 64, align: 'right' },
  { key: 'name', label: t('col.name'), width: 200 },
  { key: 'before', label: t('col.before'), width: 90, align: 'right', sortable: false },
  { key: 'after', label: t('col.after'), width: 150, align: 'right', sortable: false },
  { key: 'actions', label: '', width: 90, sortable: false }
])

const view = useSession().view('unstuck', { widths: { kind: 96, id: 64, name: 200 } })

const recording = ref(watcher.recording)
const changes = ref<Change[]>(watcher.recording ? watcher.diff() : [])
const checked = ref(false)

const step = computed(() => (!recording.value ? 1 : checked.value ? 3 : 2))

function record(): void {
  watcher.record()
  recording.value = true
  checked.value = false
  changes.value = []
  toast.info(t('unstuck.waiting'))
}

function check(): void {
  if (!recording.value) {
    toast.warn(t('unstuck.notRecording'))
    return
  }

  changes.value = watcher.diff()
  checked.value = true

  if (changes.value.length === 0) toast.warn(t('unstuck.noChange'))
  else toast.success(t('unstuck.changed', { count: changes.value.length }))
}

function stop(): void {
  watcher.stop()
  recording.value = false
  checked.value = false
  changes.value = []
}

function revert(change: Change): void {
  watcher.revert(change)
  changes.value = watcher.diff()
  toast.success(t('unstuck.reverted'))
}

function toggleSwitch(change: Change): void {
  switches().setValue(change.id, !switches().value(change.id))
  watcher.rebase(change)
  changes.value = watcher.diff()
}

function setVariable(change: Change, raw: string): void {
  const value = toInt(raw)
  if (value === null) return

  variables().setValue(change.id, value)
  watcher.rebase(change)
  changes.value = watcher.diff()
}

const show = (value: boolean | number) => (typeof value === 'boolean' ? t(value ? 'common.on' : 'common.off') : value)
</script>

<template>
  <div class="content">
    <div class="strip">
      <span class="status">
        <span class="dot" :class="recording ? 'dot-warn' : 'dot-muted'" />
        {{ recording ? t('unstuck.step2') : t('unstuck.idle') }}
      </span>
      <span class="spacer" />
      <span class="hint">{{ t('unstuck.lead') }}</span>
    </div>

    <div class="content__scroll">
      <div class="steps">
        <div class="step" :class="{ 'step--on': step === 1 }">
          <div class="step__label">{{ t('unstuck.step1') }}</div>
          <button class="btn btn--primary" @click="record">
            <AppIcon name="target" :size="13" />{{ recording ? t('unstuck.rerecord') : t('unstuck.record') }}
          </button>
        </div>

        <div class="step" :class="{ 'step--on': step === 2 }">
          <div class="step__label">{{ t('unstuck.step2') }}</div>
          <div class="hint">{{ t('unstuck.waiting') }}</div>
        </div>

        <div class="step" :class="{ 'step--on': step === 3 }">
          <div class="step__label">{{ t('unstuck.step3') }}</div>
          <div class="btn-group">
            <button class="btn btn--primary" :disabled="!recording" @click="check">
              <AppIcon name="search" :size="13" />{{ t('unstuck.check') }}
            </button>
            <button class="btn" :disabled="!recording" @click="stop">{{ t('unstuck.stop') }}</button>
          </div>
        </div>
      </div>

      <div v-if="checked" class="section">
        <div class="section__head">
          <span>{{ t('unstuck.changes') }}</span><span class="tab__count">{{ changes.length }}</span>
          <span class="spacer" />
          <span class="hint">{{ t('unstuck.hint') }}</span>
        </div>
        <div class="section__body">
          <div v-if="changes.length === 0" class="empty">{{ t('unstuck.noChange') }}</div>

          <DataTable
            v-else
            v-model:sort="view.sort"
            v-model:page="view.page"
            v-model:per-page="view.perPage"
            v-model:widths="view.widths"
            :columns="columns"
            :rows="changes"
            row-key="key"
          >
            <template #kind="{ row }">
              <span class="pill" :class="row.kind === 'switch' ? 'pill--accent' : 'pill--ok'">
                {{ t(row.kind === 'switch' ? 'unstuck.switch' : 'unstuck.variable') }}
              </span>
            </template>
            <template #id="{ row }">
              <span class="cell-id">{{ row.id }}</span>
            </template>
            <template #name="{ row }">
              <span :class="{ faint: !row.name }">{{ row.name || t('common.unnamed') }}</span>
            </template>
            <template #before="{ row }">
              <span class="mono faint">{{ show(row.before) }}</span>
            </template>
            <template #after="{ row }">
              <button v-if="row.kind === 'switch'" class="btn btn--sm" @click="toggleSwitch(row)">
                <span class="dot" :class="row.after ? 'dot-ok' : 'dot-muted'" />
                {{ show(row.after) }}
              </button>
              <ValueInput v-else :value="row.after as number" :width="120" @commit="setVariable(row, $event)" />
            </template>
            <template #actions="{ row }">
              <button class="btn btn--sm" :title="t('unstuck.revert')" @click="revert(row)">
                <AppIcon name="reset" :size="12" />{{ t('unstuck.revert') }}
              </button>
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>
