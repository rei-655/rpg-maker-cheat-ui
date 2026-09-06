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

interface Row {
  id: number
  name: string
  value: unknown
}

const columns: Column[] = [
  { key: 'id', label: 'ID', width: 64, align: 'right' },
  { key: 'name', label: '이름', width: 260 },
  { key: 'value', label: '값', align: 'right' }
]

const view = useSession().view('variables', { perPage: 25, widths: { id: 64, name: 260 } })
const rows = ref<Row[]>([])
const editing = ref(new Set<number>())
const operand = ref('')

const scanner = new ValueScan((id) => variables().value(id))
const scan = reactive({ active: false, count: 0, passes: 0 })

const shown = computed(() => {
  const query = parseQuery(view.search)

  return rows.value.filter((row) => {
    if (editing.value.has(row.id)) return true
    if (view.flags.named && !row.name) return false
    if (view.flags.nonZero && !row.value) return false
    if (scan.active && view.flags.scanOnly !== false && !scanner.has(row.id)) return false

    return matches(query, { id: row.id, value: row.value, texts: [row.name] })
  })
})

onMounted(refresh)

function refresh(): void {
  const names = variableNames()

  rows.value = names
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
  view.flags.scanOnly = true
  syncScan()
  toast.info(`변수 ${scanner.count}개를 기록했다. 게임에서 값을 바꾼 뒤 조건을 눌러라.`)
}

function refine(kind: Refinement, needsOperand?: true): void {
  const value = needsOperand ? Number(operand.value) : null

  if (needsOperand && !Number.isFinite(value)) {
    toast.warn('비교할 값을 숫자로 입력해줘')
    return
  }

  const remaining = scanner.refine(kind, value)
  refresh()

  if (remaining === 0) toast.warn('남은 후보가 없다. 스냅샷부터 다시')
  else toast.success(`후보 ${remaining}개`)
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
  <div class="content">
    <div class="toolbar">
      <SearchBox
        v-model="view.search"
        placeholder="이름 · #12 · 500 · >1000 · 100..200"
        :shown="shown.length"
        :total="rows.length"
        autofocus
      />

      <div class="chips">
        <button class="chip" :class="{ 'chip--active': view.flags.named }" @click="view.flags.named = !view.flags.named">
          이름 있는 것만
        </button>
        <button
          class="chip"
          :class="{ 'chip--active': view.flags.nonZero }"
          @click="view.flags.nonZero = !view.flags.nonZero"
        >
          0 아님
        </button>
        <button
          v-if="scan.active"
          class="chip"
          :class="{ 'chip--active': view.flags.scanOnly !== false }"
          @click="view.flags.scanOnly = view.flags.scanOnly === false"
        >
          스캔 후보 {{ scan.count }}
        </button>
      </div>

      <span class="spacer" />
      <button class="btn btn--sm btn--icon" title="게임에서 다시 읽기" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="toolbar">
      <span class="chips__label">값 찾기</span>
      <button v-if="!scan.active" class="btn btn--primary" @click="startScan">
        <AppIcon name="target" :size="13" />스냅샷
      </button>
      <template v-else>
        <button
          v-for="item in REFINEMENTS"
          :key="item.key"
          class="btn btn--sm"
          :disabled="item.operand && operand === ''"
          @click="refine(item.key, item.operand)"
        >
          {{ item.label }}
        </button>
        <input v-model="operand" class="input input--num" style="width: 96px" placeholder="값" @keydown.stop />
        <span class="hint">후보 {{ scan.count }} · {{ scan.passes }}회</span>
        <button class="btn btn--sm" @click="stopScan">중지</button>
      </template>
      <span class="spacer" />
      <span class="hint">게임을 조작한 뒤 조건을 눌러 후보를 좁힌다</span>
    </div>

    <div class="content__scroll">
      <DataTable
        v-model:sort="view.sort"
        v-model:page="view.page"
        v-model:per-page="view.perPage"
        v-model:widths="view.widths"
        :columns="columns"
        :rows="shown"
        empty-text="조건에 맞는 변수가 없습니다."
      >
        <template #id="{ row }">
          <span class="cell-id">{{ row.id }}</span>
        </template>
        <template #name="{ row }">
          <span :class="{ faint: !row.name }">{{ row.name || '(이름 없음)' }}</span>
        </template>
        <template #value="{ row }">
          <ValueInput :value="row.value as number" @edit-start="pin(row.id)" @commit="commit(row, $event)" />
        </template>
      </DataTable>
    </div>
  </div>
</template>
