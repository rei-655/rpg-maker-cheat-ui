<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { party, rpg } from '@/engine/globals'
import type { DataItem } from '@/engine/types'
import { matches, parseQuery } from '@/shared/lib/query'
import { clamp, toInt } from '@/shared/lib/coerce'
import { confirm } from '@/shared/composables/useConfirm'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'

interface Row {
  id: number
  name: string
  desc: string
  amount: number
  max: number
  data: DataItem
}

const TABS = [
  { key: 'items', label: '아이템', source: () => rpg('$dataItems') },
  { key: 'weapons', label: '무기', source: () => rpg('$dataWeapons') },
  { key: 'armors', label: '방어구', source: () => rpg('$dataArmors') }
] as const

const columns: Column[] = [
  { key: 'id', label: 'ID', width: 64, align: 'right' },
  { key: 'name', label: '이름', width: 200 },
  { key: 'desc', label: '설명', width: 260 },
  { key: 'amount', label: '보유', width: 210, align: 'right' }
]

const view = useSession().view('items', {
  tab: 'items',
  perPage: 25,
  widths: { id: 64, name: 200, desc: 260 }
})

const rows = ref<Row[]>([])
const counts = reactive<Record<string, number>>({ items: 0, weapons: 0, armors: 0 })

const shown = computed(() => {
  const query = parseQuery(view.search)

  return rows.value.filter(
    (row) =>
      (!view.flags.owned || Number(row.amount) > 0) &&
      matches(query, { id: row.id, value: row.amount, texts: [row.name, row.desc] })
  )
})

onMounted(refresh)

function selectTab(key: string): void {
  view.tab = key
  view.page = 1
  refresh()
}

function refresh(): void {
  const tab = TABS.find((entry) => entry.key === view.tab) ?? TABS[0]

  rows.value = (tab.source() ?? [])
    .filter((data): data is DataItem => !!data)
    .map((data) => ({
      id: data.id,
      name: data.name || '',
      desc: data.description ?? '',
      amount: party().numItems(data),
      max: party().maxItems(data),
      data
    }))

  for (const entry of TABS) counts[entry.key] = (entry.source() ?? []).filter(Boolean).length
}

function commit(row: Row, raw: string | number): void {
  const requested = toInt(raw)

  if (requested === null) {
    row.amount = party().numItems(row.data)
    return
  }

  party().gainItem(row.data, clamp(requested, 0, row.max) - party().numItems(row.data))
  row.amount = party().numItems(row.data)
}

async function fillAll(): Promise<void> {
  const targets = [...shown.value]

  const ok = await confirm({
    title: '목록 전체 최대',
    message: `현재 목록의 ${targets.length}개를 모두 최대치로 채운다.`,
    confirmText: '채우기'
  })

  if (!ok) return

  targets.forEach((row) => commit(row, row.max))
  toast.success(`${targets.length}개를 최대치로 채웠다`)
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
        @click="selectTab(tab.key)"
      >
        {{ tab.label }}<span class="tab__count">{{ counts[tab.key] }}</span>
      </button>
    </div>

    <div class="toolbar">
      <SearchBox
        v-model="view.search"
        placeholder="이름 · 설명 · #12 · >0"
        :shown="shown.length"
        :total="rows.length"
        autofocus
      />

      <div class="chips">
        <button class="chip" :class="{ 'chip--active': view.flags.owned }" @click="view.flags.owned = !view.flags.owned">
          보유 중만
        </button>
      </div>

      <span class="spacer" />
      <button class="btn btn--sm" :disabled="shown.length === 0" @click="fillAll">목록 전체 최대</button>
      <button class="btn btn--sm btn--icon" title="게임에서 다시 읽기" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <DataTable
        v-model:sort="view.sort"
        v-model:page="view.page"
        v-model:per-page="view.perPage"
        v-model:widths="view.widths"
        :columns="columns"
        :rows="shown"
        empty-text="조건에 맞는 항목이 없습니다."
      >
        <template #id="{ row }">
          <span class="cell-id">{{ row.id }}</span>
        </template>
        <template #desc="{ row }">
          <span class="faint">{{ row.desc }}</span>
        </template>
        <template #amount="{ row }">
          <div class="row">
            <ValueInput :value="row.amount" :width="72" @commit="commit(row, $event)" />
            <span class="mono faint nowrap">/ {{ row.max }}</span>
            <button class="btn btn--sm" title="최대치" @click="commit(row, row.max)">Max</button>
          </div>
        </template>
      </DataTable>
    </div>
  </div>
</template>
