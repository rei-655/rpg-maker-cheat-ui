<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { describe, probe, readProbe, writeProbe, type Field, type Probe, type Structure } from '@/engine/probe'
import { matches, parseQuery } from '@/shared/lib/query'
import { coerceLike } from '@/shared/lib/coerce'
import { REFINEMENTS, ValueScan, type Refinement } from '@/shared/lib/scan'
import * as watchlist from './watchlist'
import type { Watch, WatchRow } from './watchlist'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { t } from '@/i18n'

interface Row extends Probe {
  value: number
}

const columns = computed<Column[]>(() => [
  { key: 'owner', label: t('col.where'), width: 300, mono: true },
  { key: 'key', label: t('col.field'), width: 180, mono: true },
  { key: 'value', label: t('col.value'), align: 'right' },
  { key: 'actions', label: '', width: 48, sortable: false }
])

const fieldColumns = computed<Column[]>(() => [
  { key: 'key', label: t('col.field'), width: 200, mono: true },
  { key: 'kind', label: t('col.kind'), width: 90, sortable: false },
  { key: 'text', label: t('col.value'), sortable: false },
  { key: 'actions', label: '', width: 48, sortable: false }
])

const view = useSession().view('data.finder', {
  sort: { key: 'owner', desc: false },
  widths: { owner: 300, key: 180 }
})

const rows = ref<Row[]>([])
const keysOf = new Map<string, string[]>()

// 詳細は「見つけた値の入れ物」を指す。潜るとここだけが動く。
const cursor = ref<string[]>([])
const structure = ref<Structure | null>(null)
const selected = ref<string | null>(null)

// 保存した値。絞り込みは手間がかかるので、たどり着いた場所は覚えておく。
const watches = ref<Watch[]>([])
const watchRows = ref<WatchRow[]>([])

const scanner = new ValueScan<string>((path) => readProbe(keysOf.get(path) ?? []))
const scan = reactive({ active: false, count: 0, passes: 0 })
const operand = ref('')

const shown = computed(() => {
  const query = parseQuery(view.search)

  return rows.value.filter((row) => {
    if (view.flags.nonZero && !row.value) return false
    if (scan.active && view.flags.onlyCandidates !== false && !scanner.has(row.path)) return false

    return matches(query, { id: row.path, value: row.value, texts: [row.path] })
  })
})

onMounted(() => {
  watches.value = watchlist.load()
  readWatches()
  collect()
})

/** グローバルを歩き直す。ゲームが進むと入れ物そのものが増えることがある。 */
function collect(): void {
  keysOf.clear()

  rows.value = probe().map((entry) => {
    keysOf.set(entry.path, entry.keys)
    return entry as Row
  })

  readWatches()
  syncScan()
}

/** 値だけ読み直す。歩き直しより速く、スキャン中の候補がずれない。 */
function sync(): void {
  for (const row of rows.value) {
    const current = readProbe(row.keys)
    if (typeof current === 'number') row.value = current
  }

  readWatches()
}

function commit(row: Row, raw: string): void {
  const next = coerceLike(raw, row.value)

  if (!writeProbe(row.keys, next)) {
    toast.warn(t('finder.writeFailed'))
    return
  }

  const current = readProbe(row.keys)
  if (typeof current === 'number') row.value = current

  readWatches()
  if (selected.value === row.path) refreshStructure()
}

// ----------------------------------------------------------------
// 保存
// ----------------------------------------------------------------

function readWatches(): void {
  watchRows.value = watchlist.resolveAll(watches.value)
}

function isSaved(path: string): boolean {
  return watchlist.saved(watches.value, path)
}

function keep(target: Probe | { path: string; keys: string[]; key: string }): void {
  if (isSaved(target.path)) return

  watches.value = watchlist.add(watches.value, target as Probe)
  readWatches()
  toast.success(t('finder.savedToast', { name: target.key }))
}

function keepField(field: Field): void {
  const keys = cursor.value.concat(field.key)
  keep({ path: keys.join('.'), keys, key: field.key })
}

function drop(entry: WatchRow): void {
  watches.value = watchlist.remove(watches.value, entry.key)
  readWatches()
}

function renameWatch(entry: WatchRow, name: string): void {
  watches.value = watchlist.rename(watches.value, entry.key, name)
  readWatches()
}

function commitWatch(entry: WatchRow, raw: string): void {
  if (!writeProbe(entry.keys, coerceLike(raw, entry.field.value))) {
    toast.warn(t('finder.writeFailed'))
    return
  }

  sync()
  if (selected.value) refreshStructure()
}

function openWatch(entry: WatchRow): void {
  cursor.value = entry.keys.slice(0, -1)
  selected.value = entry.path
  refreshStructure()
}

// ----------------------------------------------------------------
// 構造
// ----------------------------------------------------------------

function select(row: Row): void {
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

// ----------------------------------------------------------------
// 絞り込み
// ----------------------------------------------------------------

function startScan(): void {
  scanner.start(rows.value.map((row) => row.path))
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
        <span v-if="watchRows.length > 0" class="tab__count">{{ watchRows.length }}</span>
        <span class="spacer" />
        <span class="hint">{{ t('finder.savedHint') }}</span>
      </div>

      <div class="section__body">
        <div v-if="watchRows.length === 0" class="empty">{{ t('finder.noSaved') }}</div>

        <div v-else class="table-wrap">
          <table class="table">
            <colgroup>
              <col style="width: 200px" />
              <col />
              <col style="width: 140px" />
              <col style="width: 48px" />
            </colgroup>
            <thead>
              <tr>
                <th>{{ t('col.name') }}</th>
                <th>{{ t('col.where') }}</th>
                <th class="num">{{ t('col.value') }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in watchRows" :key="entry.key">
                <td>
                  <ValueInput :value="entry.name" text @commit="renameWatch(entry, $event)" />
                </td>
                <td>
                  <span class="mono faint clickable" :title="t('finder.openSaved')" @click="openWatch(entry)">
                    {{ entry.path }}
                  </span>
                </td>
                <td class="num">
                  <ValueInput
                    v-if="entry.found && entry.field.editable"
                    :value="entry.field.text"
                    :text="entry.field.kind !== 'number'"
                    @commit="commitWatch(entry, $event)"
                  />
                  <span v-else-if="entry.found" class="mono faint">{{ entry.field.text }}</span>
                  <span v-else class="pill pill--warn">{{ t('finder.missing') }}</span>
                </td>
                <td>
                  <button class="btn btn--sm btn--icon" :title="t('common.delete')" @click="drop(entry)">
                    <AppIcon name="trash" :size="13" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
        <ValueInput :value="row.value" @commit="commit(row, $event)" @click.stop />
      </template>
      <template #actions="{ row }">
        <button
          class="btn btn--sm btn--icon"
          :disabled="isSaved(row.path)"
          :title="t(isSaved(row.path) ? 'finder.alreadySaved' : 'finder.save')"
          @click.stop="keep(row)"
        >
          <AppIcon :name="isSaved(row.path) ? 'check' : 'save'" :size="13" />
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
                <td><span class="faint">{{ field.kind }}</span></td>
                <td>
                  <ValueInput
                    v-if="field.editable"
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
                    :disabled="isSaved(cursor.concat(field.key).join('.'))"
                    :title="t(isSaved(cursor.concat(field.key).join('.')) ? 'finder.alreadySaved' : 'finder.save')"
                    @click.stop="keepField(field)"
                  >
                    <AppIcon :name="isSaved(cursor.concat(field.key).join('.')) ? 'check' : 'save'" :size="13" />
                  </button>
                </td>
              </tr>
              <tr v-if="structure.fields.length === 0">
                <td :colspan="fieldColumns.length"><div class="empty">{{ t('finder.emptyFields') }}</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
