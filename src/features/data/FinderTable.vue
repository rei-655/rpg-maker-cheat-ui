<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import {
  describe,
  probe,
  readProbe,
  writeProbe,
  type Field,
  type Probe,
  type ProbeKind,
  type Structure
} from '@/engine/probe'
import { matches, parseQuery } from '@/shared/lib/query'
import { coerceLike } from '@/shared/lib/coerce'
import { REFINEMENTS, ValueScan, type Refinement } from '@/shared/lib/scan'
import SavedValues from './SavedValues.vue'
import type { WatchRow } from './watchlist'
import { useWatches } from '@/stores/watches'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { t } from '@/i18n'

const KINDS: ProbeKind[] = ['number', 'string', 'boolean']

const columns = computed<Column[]>(() => [
  { key: 'owner', label: t('col.where'), width: 300, mono: true },
  { key: 'key', label: t('col.field'), width: 170, mono: true },
  { key: 'value', label: t('col.value'), align: 'right' },
  { key: 'actions', label: '', width: 48, sortable: false }
])

const fieldColumns = computed<Column[]>(() => [
  { key: 'key', label: t('col.field'), width: 190, mono: true },
  { key: 'kind', label: t('col.kind'), width: 84, sortable: false },
  { key: 'text', label: t('col.value'), sortable: false },
  { key: 'actions', label: '', width: 48, sortable: false }
])

const view = useSession().view('data.finder', {
  sort: { key: 'owner', desc: false },
  widths: { owner: 300, key: 170 },
  // 既定は数値だけ。文字列と真偽値は件数が多く、目的の値を埋めてしまう。
  flags: { number: true }
})

const watches = useWatches()
const rows = ref<Probe[]>([])
const keysOf = new Map<string, string[]>()

// 詳細は「見つけた値の入れ物」を指す。潜るとここだけが動く。
const cursor = ref<string[]>([])
const structure = ref<Structure | null>(null)
const selected = ref<string | null>(null)

const scanner = new ValueScan<string>((path) => readProbe(keysOf.get(path) ?? []))
const scan = reactive({ active: false, count: 0, passes: 0 })
const operand = ref('')

/** 型の絞り込みは、どれも押していないときは全部見せる。空の表より親切。 */
const kinds = computed(() => {
  const picked = KINDS.filter((kind) => view.flags[kind])
  return picked.length > 0 ? picked : KINDS
})

const counts = computed(() => {
  const tally: Record<string, number> = { number: 0, string: 0, boolean: 0 }
  for (const row of rows.value) tally[row.kind] += 1
  return tally
})

const shown = computed(() => {
  const query = parseQuery(view.search)
  const allowed = kinds.value

  return rows.value.filter((row) => {
    if (allowed.indexOf(row.kind) < 0) return false
    if (view.flags.nonZero && !row.value) return false
    if (scan.active && view.flags.onlyCandidates !== false && !scanner.has(row.path)) return false

    return matches(query, { id: row.path, value: row.value, texts: [row.path, String(row.value)] })
  })
})

onMounted(collect)

/** グローバルを歩き直す。ゲームが進むと入れ物そのものが増えることがある。 */
function collect(): void {
  keysOf.clear()

  rows.value = probe().map((entry) => {
    keysOf.set(entry.path, entry.keys)
    return entry
  })

  watches.refresh()
  syncScan()
}

/** 値だけ読み直す。歩き直しより速く、スキャン中の候補がずれない。 */
function sync(): void {
  for (const row of rows.value) {
    const current = readProbe(row.keys)
    if (typeof current === row.kind) row.value = current as Probe['value']
  }

  watches.refresh()
}

function commit(row: Probe, raw: string): void {
  if (!writeProbe(row.keys, coerceLike(raw, row.value))) {
    toast.warn(t('finder.writeFailed'))
    return
  }

  sync()
  if (selected.value === row.path) refreshStructure()
}

/** テンプレートで型を絞ると | が Vue のフィルタと読まれる。ここで済ませる。 */
function editable(row: Probe): string | number {
  return row.kind === 'number' ? (row.value as number) : String(row.value)
}

function toggle(row: Probe): void {
  commit(row, row.value === true ? 'false' : 'true')
}

// ----------------------------------------------------------------
// 保存
// ----------------------------------------------------------------

function keep(path: string, keys: string[], name: string): void {
  if (watches.keep({ kind: 'path', keys, name })) toast.success(t('finder.savedToast', { name }))
  else if (watches.isSaved(path)) toast.info(t('finder.alreadySaved'))
}

function keepField(field: Field): void {
  const keys = cursor.value.concat(field.key)
  keep(keys.join('.'), keys, field.key)
}

function openSaved(row: WatchRow): void {
  if (row.kind !== 'path') return

  cursor.value = row.keys.slice(0, -1)
  selected.value = row.ref
  refreshStructure()
}

// ----------------------------------------------------------------
// 構造
// ----------------------------------------------------------------

function select(row: Probe): void {
  selected.value = row.path
  cursor.value = row.keys.slice(0, -1)
  refreshStructure()
}

function drill(field: Field): void {
  if (field.editable || field.size === 0) return

  cursor.value = cursor.value.concat(field.key)
  refreshStructure()
}

function goUp(depth: number): void {
  cursor.value = cursor.value.slice(0, depth + 1)
  refreshStructure()
}

function close(): void {
  selected.value = null
  cursor.value = []
  structure.value = null
}

function refreshStructure(): void {
  structure.value = cursor.value.length > 0 ? describe(cursor.value) : null
}

function commitField(field: Field, raw: string): void {
  const keys = cursor.value.concat(field.key)

  if (!writeProbe(keys, coerceLike(raw, field.value))) {
    toast.warn(t('finder.writeFailed'))
    return
  }

  refreshStructure()
  sync()
}

function toggleField(field: Field): void {
  commitField(field, field.value === true ? 'false' : 'true')
}

// ----------------------------------------------------------------
// 絞り込み
// ----------------------------------------------------------------

function startScan(): void {
  scanner.start(shown.value.map((row) => row.path))
  view.flags.onlyCandidates = true
  syncScan()
  toast.info(t('finder.scanStarted', { count: scanner.count }))
}

function refine(kind: Refinement, needsOperand?: true): void {
  const value = needsOperand ? Number(operand.value) : null

  if (needsOperand && !Number.isFinite(value)) {
    toast.warn(t('data.needNumber'))
    return
  }

  const remaining = scanner.refine(kind, value)
  sync()
  syncScan()

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
    <div class="section">
      <div class="section__head">
        <span>{{ t('finder.saved') }}</span>
        <span v-if="watches.rows.length > 0" class="tab__count">{{ watches.rows.length }}</span>
        <span class="spacer" />
        <span class="hint">{{ t('finder.savedHint') }}</span>
      </div>

      <div class="section__body">
        <SavedValues @open="openSaved" />
      </div>
    </div>

    <div class="toolbar">
      <SearchBox
        v-model="view.search"
        :placeholder="t('finder.search')"
        :shown="shown.length"
        :total="rows.length"
        autofocus
      />

      <div class="chips">
        <span class="chips__label">{{ t('finder.kind') }}</span>
        <button
          v-for="kind in KINDS"
          :key="kind"
          class="chip"
          :class="{ 'chip--active': view.flags[kind] }"
          :title="t('finder.kindHint')"
          @click="view.flags[kind] = !view.flags[kind]"
        >
          {{ t(`kind.${kind}`) }} {{ counts[kind] }}
        </button>

        <span class="chips__sep" />

        <button
          class="chip"
          :class="{ 'chip--active': view.flags.nonZero }"
          @click="view.flags.nonZero = !view.flags.nonZero"
        >
          {{ t('finder.notEmpty') }}
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
      <button class="btn btn--sm btn--icon" :title="t('finder.recollect')" @click="collect">
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
          <input
            v-model="operand"
            class="input input--num"
            style="width: 90px"
            :placeholder="t('col.value')"
            @keydown.stop
          />
          <span class="hint">{{ t('data.candidates', { count: scan.count, passes: scan.passes }) }}</span>
          <button class="btn btn--sm" @click="stopScan">{{ t('data.scanStop') }}</button>
        </template>
        <span class="spacer" />
        <span class="hint">{{ t('finder.scanHint') }}</span>
      </div>
    </details>

    <DataTable
      v-model:sort="view.sort"
      v-model:page="view.page"
      v-model:per-page="view.perPage"
      v-model:widths="view.widths"
      style="margin-top: 8px"
      row-key="path"
      clickable
      :columns="columns"
      :rows="shown"
      :selected-key="selected"
      :empty-text="t('finder.empty')"
      @row-click="select"
    >
      <template #owner="{ row }">
        <span class="mono faint">{{ row.owner }}</span>
      </template>
      <template #key="{ row }">
        <span class="mono">{{ row.key }}</span>
      </template>
      <template #value="{ row }">
        <button v-if="row.kind === 'boolean'" class="btn btn--sm" @click.stop="toggle(row)">
          <span class="dot" :class="row.value === true ? 'dot-ok' : 'dot-muted'" />
          {{ t(row.value === true ? 'common.on' : 'common.off') }}
        </button>
        <ValueInput
          v-else
          :value="editable(row)"
          :text="row.kind === 'string'"
          @commit="commit(row, $event)"
          @click.stop
        />
      </template>
      <template #actions="{ row }">
        <button
          class="btn btn--sm btn--icon"
          :disabled="watches.isSaved(row.path)"
          :title="t(watches.isSaved(row.path) ? 'finder.alreadySaved' : 'finder.save')"
          @click.stop="keep(row.path, row.keys, row.key)"
        >
          <AppIcon :name="watches.isSaved(row.path) ? 'check' : 'save'" :size="13" />
        </button>
      </template>
    </DataTable>

    <div v-if="structure" class="detail">
      <div class="detail__head">
        <span>{{ t('finder.structure') }}</span>
        <span class="spacer" />
        <span class="pill pill--accent">{{ structure.type }}</span>
        <button class="btn btn--sm btn--icon" :title="t('common.close')" @click="close">
          <AppIcon name="close" :size="13" />
        </button>
      </div>

      <div class="detail__body">
        <div class="chips" style="margin-bottom: 8px">
          <button
            v-for="(segment, depth) in cursor"
            :key="depth"
            class="chip"
            :class="{ 'chip--active': depth === cursor.length - 1 }"
            @click="goUp(depth)"
          >
            {{ segment }}
          </button>
        </div>

        <p class="hint" style="margin: 0 0 8px">{{ t('finder.structureHint') }}</p>

        <div class="table-wrap">
          <table class="table">
            <colgroup>
              <col v-for="column in fieldColumns" :key="column.key" :style="{ width: `${column.width}px` }" />
            </colgroup>
            <thead>
              <tr>
                <th v-for="column in fieldColumns" :key="column.key">{{ column.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="field in structure.fields"
                :key="field.key"
                :class="{ clickable: !field.editable && field.size > 0 }"
                @click="drill(field)"
              >
                <td><span class="mono">{{ field.key }}</span></td>
                <td>
                  <span class="faint">{{ field.kind }}</span>
                  <span v-if="field.accessor" class="faint" :title="t('finder.accessor')"> ·</span>
                </td>
                <td>
                  <button v-if="field.kind === 'boolean'" class="btn btn--sm" @click.stop="toggleField(field)">
                    <span class="dot" :class="field.value === true ? 'dot-ok' : 'dot-muted'" />
                    {{ t(field.value === true ? 'common.on' : 'common.off') }}
                  </button>
                  <ValueInput
                    v-else-if="field.editable"
                    :value="field.text"
                    :text="field.kind !== 'number'"
                    @commit="commitField(field, $event)"
                    @click.stop
                  />
                  <span v-else class="mono faint">{{ field.text }}</span>
                </td>
                <td>
                  <button
                    v-if="field.editable"
                    class="btn btn--sm btn--icon"
                    :disabled="watches.isSaved(cursor.concat(field.key).join('.'))"
                    :title="t(watches.isSaved(cursor.concat(field.key).join('.')) ? 'finder.alreadySaved' : 'finder.save')"
                    @click.stop="keepField(field)"
                  >
                    <AppIcon :name="watches.isSaved(cursor.concat(field.key).join('.')) ? 'check' : 'save'" :size="13" />
                  </button>
                </td>
              </tr>
              <tr v-if="structure.fields.length === 0">
                <td :colspan="fieldColumns.length"><div class="empty">{{ t('finder.emptyFields') }}</div></td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="structure.hidden > 0" class="hint" style="margin: 8px 0 0">
          {{ t('finder.hidden', { count: structure.hidden }) }}
        </p>
      </div>
    </div>
  </div>
</template>
