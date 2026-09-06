<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { t } from '@/i18n'

export interface Column {
  key: string
  label: string
  width?: number
  align?: 'left' | 'right'
  sortable?: boolean
  mono?: boolean
}

const PER_PAGE = [15, 25, 50, 100, 0]
const MIN_WIDTH = 44

const {
  columns,
  rows,
  rowKey = 'id',
  emptyText = ''
} = defineProps<{
  columns: Column[]
  rows: T[]
  rowKey?: string
  emptyText?: string
}>()

const sort = defineModel<{ key: string | null; desc: boolean }>('sort', { required: true })
const page = defineModel<number>('page', { required: true })
const perPage = defineModel<number>('perPage', { required: true })
const widths = defineModel<Record<string, number>>('widths', { required: true })

const resizing = ref<{ key: string; startX: number; startWidth: number } | null>(null)

const sorted = computed(() => {
  const key = sort.value.key
  if (!key) return rows

  const direction = sort.value.desc ? -1 : 1
  return [...rows].sort((a, b) => direction * compare(a[key], b[key]))
})

const pageCount = computed(() =>
  perPage.value === 0 ? 1 : Math.max(1, Math.ceil(sorted.value.length / perPage.value))
)

const current = computed(() => Math.min(Math.max(1, page.value), pageCount.value))

const visible = computed(() => {
  if (perPage.value === 0) return sorted.value

  const start = (current.value - 1) * perPage.value
  return sorted.value.slice(start, start + perPage.value)
})

const range = computed(() => {
  const total = sorted.value.length
  if (perPage.value === 0 || total === 0) return t('common.rows', { count: total })

  const start = (current.value - 1) * perPage.value + 1
  return `${start}-${Math.min(start + perPage.value - 1, total)} / ${total}`
})

watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

onBeforeUnmount(stopResize)

function colStyle(column: Column) {
  const width = widths.value[column.key] ?? column.width
  return width ? { width: `${width}px` } : {}
}

function toggleSort(column: Column): void {
  if (column.sortable === false || resizing.value) return

  sort.value = { key: column.key, desc: sort.value.key === column.key ? !sort.value.desc : false }
}

function goTo(target: number): void {
  page.value = Math.min(Math.max(1, target), pageCount.value)
}

function startResize(column: Column, event: MouseEvent): void {
  const header = (event.target as HTMLElement).parentElement

  resizing.value = {
    key: column.key,
    startX: event.clientX,
    startWidth: header?.getBoundingClientRect().width ?? column.width ?? MIN_WIDTH
  }

  addEventListener('mousemove', onResize)
  addEventListener('mouseup', stopResize)
}

function onResize(event: MouseEvent): void {
  if (!resizing.value) return

  const next = Math.max(
    MIN_WIDTH,
    Math.round(resizing.value.startWidth + event.clientX - resizing.value.startX)
  )

  widths.value = { ...widths.value, [resizing.value.key]: next }
}

function stopResize(): void {
  if (!resizing.value) return

  resizing.value = null
  removeEventListener('mousemove', onResize)
  removeEventListener('mouseup', stopResize)
}

function resetWidth(column: Column): void {
  const next = { ...widths.value }
  delete next[column.key]
  widths.value = next
}

function compare(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''

  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)

  return String(a).localeCompare(String(b), undefined, { numeric: true })
}
</script>

<template>
  <div>
    <div class="table-wrap">
      <table class="table">
        <colgroup>
          <col v-for="column in columns" :key="column.key" :style="colStyle(column)" />
        </colgroup>
        <thead>
          <tr>
            <th
              v-for="(column, index) in columns"
              :key="column.key"
              :class="[
                column.sortable === false ? '' : 'sortable',
                column.align === 'right' ? 'num' : ''
              ]"
              @click="toggleSort(column)"
            >
              <span>{{ column.label }}</span>
              <AppIcon
                v-if="sort.key === column.key"
                class="sort"
                :name="sort.desc ? 'sortDesc' : 'sortAsc'"
                :size="11"
              />
              <span
                v-if="index < columns.length - 1"
                class="table__handle"
                :title="t('common.resizeHint')"
                @click.stop
                @mousedown.stop.prevent="startResize(column, $event)"
                @dblclick.stop.prevent="resetWidth(column)"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="row[rowKey]">
            <td v-for="column in columns" :key="column.key" :class="column.align === 'right' ? 'num' : ''">
              <slot :name="column.key" :row="row">
                <span :class="column.mono ? 'mono' : ''">{{ row[column.key] }}</span>
              </slot>
            </td>
          </tr>
          <tr v-if="visible.length === 0">
            <td :colspan="columns.length"><div class="empty">{{ emptyText || t('common.emptyRows') }}</div></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="rows.length > 0" class="pager">
      <span class="pager__pos">{{ range }}</span>
      <select v-model.number="perPage" class="input" @change="page = 1">
        <option v-for="option in PER_PAGE" :key="option" :value="option">
          {{ option === 0 ? t('common.allRows') : t('common.rows', { count: option }) }}
        </option>
      </select>
      <button class="btn btn--sm btn--icon" :disabled="current <= 1" :title="t('common.firstPage')" @click="goTo(1)">
        <AppIcon name="first" :size="13" />
      </button>
      <button class="btn btn--sm btn--icon" :disabled="current <= 1" :title="t('common.prevPage')" @click="goTo(current - 1)">
        <AppIcon name="left" :size="13" />
      </button>
      <button
        class="btn btn--sm btn--icon"
        :disabled="current >= pageCount"
        :title="t('common.nextPage')"
        @click="goTo(current + 1)"
      >
        <AppIcon name="right" :size="13" />
      </button>
      <button
        class="btn btn--sm btn--icon"
        :disabled="current >= pageCount"
        :title="t('common.lastPage')"
        @click="goTo(pageCount)"
      >
        <AppIcon name="last" :size="13" />
      </button>
    </div>
  </div>
</template>
