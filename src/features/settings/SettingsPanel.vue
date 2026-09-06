<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import CheckBox from '@/shared/ui/CheckBox.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import KeyCapture from './KeyCapture.vue'
import { ACTIONS } from '@/app/actions'
import { formatCombo } from '@/app/keys'
import { engineName } from '@/engine/engine'
import { settingsDir } from '@/engine/engine'
import { matches, parseQuery } from '@/shared/lib/query'
import { toInt } from '@/shared/lib/coerce'
import { confirm } from '@/shared/composables/useConfirm'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { useShortcuts } from '@/stores/shortcuts'

const TABS = [
  { key: 'shortcuts', label: '단축키' },
  { key: 'window', label: '창' }
] as const

const columns: Column[] = [
  { key: 'label', label: '동작', width: 240 },
  { key: 'combo', label: '단축키', width: 190 },
  { key: 'slot', label: '슬롯', width: 90, align: 'right' },
  { key: 'hint', label: '' }
]

const session = useSession()
const shortcuts = useShortcuts()
const view = session.view('settings', { tab: 'shortcuts', perPage: 0, widths: { label: 240, combo: 190 } })

const search = ref('')

const rows = computed(() => {
  const query = parseQuery(search.value)

  return ACTIONS.map((action) => ({
    id: action.id,
    label: action.label,
    hint: action.hint ?? '',
    slot: action.slot === undefined ? null : shortcuts.binding(action.id).slot,
    combo: shortcuts.binding(action.id).combo
  })).filter(
    (row) =>
      (!view.flags.assignedOnly || row.combo) &&
      matches(query, { id: row.id, texts: [row.label, row.hint, formatCombo(row.combo)] })
  )
})

function rebind(id: string, combo: string): void {
  const error = shortcuts.rebind(id, combo)
  if (error) toast.warn(error)
}

function setSlot(id: string, raw: string): void {
  const slot = toInt(raw)
  if (slot !== null) shortcuts.setSlot(id, Math.max(1, slot))
}

async function restore(): Promise<void> {
  const ok = await confirm({
    title: '단축키 초기화',
    message: '모든 단축키를 기본값으로 되돌린다.',
    confirmText: '초기화',
    danger: true
  })

  if (ok) {
    shortcuts.restoreDefaults()
    toast.success('단축키를 초기화했다')
  }
}
</script>

<template>
  <div class="content">
    <div class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="tab"
        :class="{ 'tab--active': tab.key === view.tab }"
        @click="view.tab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <template v-if="view.tab !== 'window'">
      <div class="toolbar">
        <SearchBox v-model="search" placeholder="동작 이름 · 키" :shown="rows.length" :total="ACTIONS.length" />
        <div class="chips">
          <button
            class="chip"
            :class="{ 'chip--active': view.flags.assignedOnly }"
            @click="view.flags.assignedOnly = !view.flags.assignedOnly"
          >
            배정된 것만
          </button>
        </div>
        <span class="spacer" />
        <button class="btn btn--sm" @click="restore">
          <AppIcon name="reset" :size="13" />기본값
        </button>
      </div>

      <div class="content__scroll">
        <DataTable
          v-model:sort="view.sort"
          v-model:page="view.page"
          v-model:per-page="view.perPage"
          v-model:widths="view.widths"
          :columns="columns"
          :rows="rows"
          empty-text="조건에 맞는 동작이 없습니다."
        >
          <template #combo="{ row }">
            <KeyCapture :combo="row.combo" @change="rebind(row.id, $event)" />
          </template>
          <template #slot="{ row }">
            <ValueInput v-if="row.slot !== null" :value="row.slot" :width="64" @commit="setSlot(row.id, $event)" />
            <span v-else class="faint">-</span>
          </template>
          <template #hint="{ row }">
            <span class="faint">{{ row.hint }}</span>
          </template>
        </DataTable>
      </div>
    </template>

    <div v-else class="content__scroll">
      <div class="section">
        <div class="section__head">창</div>
        <div class="section__body row-wrap">
          <CheckBox v-model="session.dimmed" label="흐리게 (마우스를 올리면 선명)" />
          <button class="btn" @click="session.resetGeometry()">
            <AppIcon name="reset" :size="13" />위치 · 크기 초기화
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section__head">정보</div>
        <div class="section__body">
          <div class="kv">
            <span class="kv__k">엔진</span><span class="mono">{{ engineName() }}</span>
            <span class="kv__k">설정 위치</span><span class="mono">{{ settingsDir() }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
