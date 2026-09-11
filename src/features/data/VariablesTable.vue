<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { variableNames, variables } from '@/engine/globals'
import { matches, parseQuery } from '@/shared/lib/query'
import { coerceLike } from '@/shared/lib/coerce'
import { REFINEMENTS, ValueScan, type Refinement } from '@/shared/lib/scan'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { t } from '@/i18n'

interface Row {
  id: number
  name: string
  value: unknown
}

const columns = computed<Column[]>(() => [
  { key: 'id', label: t('col.id'), width: 64, align: 'right' },
  { key: 'name', label: t('col.name'), width: 260 },
  { key: 'value', label: t('col.value'), align: 'right' }
])

// 名前のない枠が大半を占めるゲームが多い（701 枠中 82 個だけ、など）。
// 既定で隠し、検索したときだけ全体から探す。
const view = useSession().view('data.variables', {
  widths: { id: 64, name: 260 },
  flags: { named: true }
})
const rows = ref<Row[]>([])
const editing = ref(new Set<number>())
const operand = ref('')

const scanner = new ValueScan((id) => variables().value(id))
const scan = reactive({ active: false, count: 0, passes: 0 })

const shown = computed(() => {
  const query = parseQuery(view.search)

  return rows.value.filter((row) => {
    if (editing.value.has(row.id)) return true
    if (view.flags.named && !row.name && query.empty) return false
    if (view.flags.nonZero && !row.value) return false
    if (scan.active && view.flags.onlyCandidates !== false && !scanner.has(row.id)) return false

    return matches(query, { id: row.id, value: row.value, texts: [row.name] })
  })
})

onMounted(refresh)

function refresh(): void {
  rows.value = variableNames()
    .map((name, id) => ({ id, name: name ?? '', value: id > 0 ? variables().value(id) : 0 }))
    .slice(1)

  syncScan()
}

function pin(id: number): void {
  editing.value = new Set(editing.value).add(id)
}

function commit(row: Row, raw: string): void {
  variables().setValue(row.id, coerceLike(raw, variables().value(row.id)) as number)
  row.value = variables().value(row.id)

  const next = new Set(editing.value)
  next.delete(row.id)
  editing.value = next
}

function startScan(): void {
  scanner.start(rows.value.map((row) => row.id))
  view.flags.onlyCandidates = true
  syncScan()
  toast.info(t('data.scanStarted', { count: scanner.count }))
}

function refine(kind: Refinement, needsOperand?: true): void {
  const value = needsOperand ? Number(operand.value) : null

  if (needsOperand && !Number.isFinite(value)) {
    toast.warn(t('data.needNumber'))
    return
  }

  const remaining = scanner.refine(kind, value)
  refresh()

  if (remaining === 0) toast.warn(t('data.noCandidates'))
}

function stopScan(): void {
  scanner.reset()
  syncScan()
}

function syncScan(): void {
  scan.active = scanner.active
  scan.count = scanner.count
  scan.passes = scanner.passes
}
</script>

<template>
  <div>
    <div class="toolbar">
      <SearchBox
        v-model="view.search"
        :placeholder="t('data.variableSearch')"
        :shown="shown.length"
        :total="rows.length"
        autofocus
      />

      <div class="chips">
        <button class="chip" :class="{ 'chip--active': view.flags.named }" @click="view.flags.named = !view.flags.named">
          {{ t('data.namedOnly') }}
        </button>
        <button
          class="chip"
          :class="{ 'chip--active': view.flags.nonZero }"
          @click="view.flags.nonZero = !view.flags.nonZero"
        >
          {{ t('data.nonZero') }}
        </button>
        <button
          v-if="scan.active"
          class="chip"
          :class="{ 'chip--active': view.flags.onlyCandidates !== false }"
          @click="view.flags.onlyCandidates = view.flags.onlyCandidates === false"
        >
          {{ t('data.onlyCandidates') }} {{ scan.count }}
        </button>
      </div>

      <span class="spacer" />
      <button class="btn btn--sm btn--icon" :title="t('common.refresh')" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <details class="more" :open="scan.active">
      <summary>{{ t('data.scan') }}</summary>

      <div class="row-wrap">
        <button v-if="!scan.active" class="btn btn--primary" @click="startScan">
          <AppIcon name="target" :size="13" />{{ t('data.scanStart') }}
        </button>
        <template v-else>
          <button
            v-for="item in REFINEMENTS"
            :key="item.key"
            class="btn btn--sm"
            :disabled="item.operand && operand === ''"
            @click="refine(item.key, item.operand)"
          >
            {{ t(`scan.${item.key}`) }}
          </button>
          <input v-model="operand" class="input input--num" style="width: 90px" :placeholder="t('col.value')" @keydown.stop />
          <span class="hint">{{ t('data.candidates', { count: scan.count, passes: scan.passes }) }}</span>
          <button class="btn btn--sm" @click="stopScan">{{ t('data.scanStop') }}</button>
        </template>
        <span class="spacer" />
        <span class="hint">{{ t('data.scanHint') }}</span>
      </div>
    </details>

    <DataTable
      v-model:sort="view.sort"
      v-model:page="view.page"
      v-model:per-page="view.perPage"
      v-model:widths="view.widths"
      style="margin-top: 8px"
      :columns="columns"
      :rows="shown"
      :empty-text="t('data.emptyVariables')"
    >
      <template #id="{ row }">
        <span class="cell-id">{{ row.id }}</span>
      </template>
      <template #name="{ row }">
        <span :class="{ faint: !row.name }">{{ row.name || t('common.unnamed') }}</span>
      </template>
      <template #value="{ row }">
        <ValueInput :value="row.value as number" @edit-start="pin(row.id)" @commit="commit(row, $event)" />
      </template>
    </DataTable>
  </div>
</template>
