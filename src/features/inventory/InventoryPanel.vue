<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { rpg } from '@/engine/globals'
import { MAX_GOLD, wallet } from '@/engine/cheats'
import { databaseEntries, heldCount, heldMax, isIndependent, setHeld } from '@/engine/inventory'
import type { DataItem } from '@/engine/types'
import { matches, parseQuery } from '@/shared/lib/query'
import { toInt } from '@/shared/lib/coerce'
import { confirm } from '@/shared/composables/useConfirm'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { t } from '@/i18n'

interface Row {
  id: number
  name: string
  desc: string
  amount: number
  max: number
  data: DataItem
}

const TABS = [
  { key: 'items', source: () => rpg('$dataItems') },
  { key: 'weapons', source: () => rpg('$dataWeapons') },
  { key: 'armors', source: () => rpg('$dataArmors') }
] as const

const columns = computed<Column[]>(() => [
  { key: 'id', label: t('col.id'), width: 64, align: 'right' },
  { key: 'name', label: t('col.name'), width: 200 },
  { key: 'desc', label: t('col.desc'), width: 260 },
  { key: 'amount', label: t('col.amount'), width: 210, align: 'right' }
])

const view = useSession().view('inventory', {
  tab: 'items',
  widths: { id: 64, name: 200, desc: 260 }
})

const rows = ref<Row[]>([])
const gold = ref(0)
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

  // 独立アイテムの複製は元の項目の行にまとめる。出すと持つたびに行が増える。
  rows.value = databaseEntries(tab.source()).map((data) => ({
    id: data.id,
    name: data.name || '',
    desc: data.description ?? '',
    amount: heldCount(data),
    max: heldMax(data),
    data
  }))

  for (const entry of TABS) counts[entry.key] = databaseEntries(entry.source()).length

  gold.value = wallet.gold()
}

function setGold(raw: string | number): void {
  const value = toInt(raw)
  if (value !== null) wallet.setGold(value)
  gold.value = wallet.gold()
}

/** 上限は書く直前に取り直す。独立アイテムは種類全体で空きを分け合う。 */
function commit(row: Row, raw: string | number): void {
  const requested = toInt(raw)

  if (requested !== null) row.amount = setHeld(row.data, requested)
  else row.amount = heldCount(row.data)

  refreshLimits()
}

function fillToMax(row: Row): void {
  commit(row, heldMax(row.data))
}

/** 空きを共有する品目は、1 つ埋めると他の上限も変わる。 */
function refreshLimits(): void {
  for (const row of rows.value) row.max = heldMax(row.data)
}

async function fillAll(): Promise<void> {
  // 独立アイテムは上限を種類全体で共有するので「全部を最大に」が成り立たない。
  // 先頭の 1 品目が空きを使い切り、残りは作られないか上限を超えて作られる。
  const targets = shown.value.filter((row) => !isIndependent(row.data))
  const skipped = shown.value.length - targets.length

  if (targets.length === 0) {
    toast.warn(t('inventory.fillIndependent'))
    return
  }

  const ok = await confirm({
    title: t('inventory.fillAll'),
    message: t('inventory.fillMessage', { count: targets.length }),
    confirmText: t('common.max')
  })

  if (!ok) return

  targets.forEach((row) => fillToMax(row))
  toast.success(t('inventory.filledToast', { count: targets.length }))

  if (skipped > 0) toast.info(t('inventory.skippedIndependent', { count: skipped }))
}
</script>

<template>
  <div class="content">
    <div class="strip">
      <div class="field">
        <span class="field__label">{{ t('inventory.gold') }}</span>
        <div class="row">
          <ValueInput :value="gold" :width="150" :title="t('common.commitHint')" @commit="setGold" />
          <button class="btn btn--sm" :title="t('common.max')" @click="setGold(MAX_GOLD)">{{ t('common.max') }}</button>
        </div>
      </div>
      <span class="spacer" />
      <span class="hint">{{ t('inventory.lead') }}</span>
    </div>

    <div class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="tab"
        :class="{ 'tab--active': tab.key === view.tab }"
        @click="selectTab(tab.key)"
      >
        {{ t(`inventory.${tab.key}`) }}<span class="tab__count">{{ counts[tab.key] }}</span>
      </button>
    </div>

    <div class="toolbar">
      <SearchBox
        v-model="view.search"
        :placeholder="t('inventory.search')"
        :shown="shown.length"
        :total="rows.length"
        autofocus
      />

      <div class="chips">
        <button class="chip" :class="{ 'chip--active': view.flags.owned }" @click="view.flags.owned = !view.flags.owned">
          {{ t('inventory.ownedOnly') }}
        </button>
      </div>

      <span class="spacer" />
      <button class="btn btn--sm" :disabled="shown.length === 0" @click="fillAll">{{ t('inventory.fillAll') }}</button>
      <button class="btn btn--sm btn--icon" :title="t('common.refresh')" @click="refresh">
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
        :empty-text="t('inventory.empty')"
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
            <button class="btn btn--sm" :title="t('common.max')" @click="fillToMax(row)">Max</button>
          </div>
        </template>
      </DataTable>
    </div>
  </div>
</template>
