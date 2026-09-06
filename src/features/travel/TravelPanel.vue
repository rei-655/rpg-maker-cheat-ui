<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { currentMapId, has, player } from '@/engine/globals'
import { listMaps, mapPath, teleport, type MapEntry } from '@/engine/maps'
import { visits } from '@/engine/visits'
import { matches, parseQuery } from '@/shared/lib/query'
import { toInt } from '@/shared/lib/coerce'
import { addCurrent, load, remove, rename, type Bookmark } from './bookmarks'
import { confirm } from '@/shared/composables/useConfirm'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { t } from '@/i18n'

interface Spot {
  key: string
  name: string
  mapId: number
  mapName: string
  x: number
  y: number
}

const spotColumns = computed<Column[]>(() => [
  { key: 'name', label: t('col.name'), width: 180 },
  { key: 'mapName', label: t('col.map') },
  { key: 'coord', label: t('col.coord'), width: 120, sortable: false },
  { key: 'actions', label: '', width: 120, sortable: false }
])

const visitColumns = computed<Column[]>(() => [
  { key: 'mapName', label: t('col.map') },
  { key: 'coord', label: t('col.coord'), width: 120, sortable: false },
  { key: 'actions', label: '', width: 80, sortable: false }
])

const mapColumns = computed<Column[]>(() => [
  { key: 'id', label: t('col.id'), width: 64, align: 'right' },
  { key: 'name', label: t('col.name'), width: 200 },
  { key: 'path', label: t('col.path') },
  { key: 'actions', label: '', width: 80, sortable: false }
])

const session = useSession()
const view = session.view('travel', { perPage: 15, widths: { id: 64, name: 200 } })
const spotView = session.view('travel.spots', { sort: { key: 'name', desc: false }, perPage: 10 })
const visitView = session.view('travel.visits', { sort: { key: 'mapName', desc: false }, perPage: 10 })

const maps = ref<MapEntry[]>([])
const spots = ref<Bookmark[]>([])
const recent = ref<Spot[]>([])
const alias = ref('')
const target = reactive({ x: '0', y: '0' })
const here = reactive({ mapId: 0, path: '', x: 0, y: 0 })

const spotRows = computed<Spot[]>(() =>
  spots.value.map((entry) => ({ ...entry, mapName: mapPath(entry.mapId) || `#${entry.mapId}` }))
)

const shownMaps = computed(() => {
  const query = parseQuery(view.search)
  return maps.value.filter((map) => matches(query, { id: map.id, value: map.id, texts: [map.name, map.path] }))
})

onMounted(refresh)

function refresh(): void {
  maps.value = listMaps()
  spots.value = load()
  recent.value = visits()
    .filter((visit) => visit.mapId !== currentMapId())
    .map((visit) => ({
      key: `r${visit.mapId}`,
      name: '',
      mapId: visit.mapId,
      mapName: mapPath(visit.mapId) || `#${visit.mapId}`,
      x: visit.x,
      y: visit.y
    }))

  readHere()
}

function readHere(): void {
  here.mapId = currentMapId()
  here.path = mapPath(here.mapId)
  here.x = has('$gamePlayer') ? player().x : 0
  here.y = has('$gamePlayer') ? player().y : 0

  if (target.x === '0' && target.y === '0') {
    target.x = String(here.x)
    target.y = String(here.y)
  }
}

function goTo(mapId: number, x: number, y: number): void {
  teleport(mapId, x, y)
  readHere()
}

function warp(map: MapEntry): void {
  goTo(map.id, toInt(target.x, 0)!, toInt(target.y, 0)!)
}

function useCurrentCoord(): void {
  readHere()
  target.x = String(here.x)
  target.y = String(here.y)
}

function onAliasKeydown(event: KeyboardEvent): void {
  event.stopPropagation()

  if (event.key === 'Enter') {
    event.preventDefault()
    saveHere()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    alias.value = ''
  }
}

function saveHere(): void {
  spots.value = addCurrent(spots.value, alias.value)
  alias.value = ''
  toast.success(t('travel.savedToast'))
}

async function removeSpot(spot: Spot): Promise<void> {
  const ok = await confirm({
    title: t('travel.deleteTitle'),
    message: t('travel.deleteMessage', { name: spot.name || t('common.unnamed') }),
    confirmText: t('common.delete'),
    danger: true
  })

  if (ok) spots.value = remove(spots.value, spot.key)
}
</script>

<template>
  <div class="content">
    <div class="strip">
      <span class="status">
        <span class="dot dot-ok" />
        {{ t('travel.here') }} <b>{{ here.path || t('common.unknown') }}</b>
        <span class="mono faint">({{ here.x }}, {{ here.y }})</span>
      </span>
      <input
        v-model="alias"
        class="input input--text"
        style="width: 160px"
        :placeholder="t('travel.aliasPlaceholder')"
        @keydown="onAliasKeydown"
      />
      <button class="btn btn--sm btn--primary" @click="saveHere">
        <AppIcon name="plus" :size="13" />{{ t('travel.saveHere') }}
      </button>
      <span class="spacer" />
      <button class="btn btn--sm btn--icon" :title="t('common.refresh')" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <div class="section">
        <div class="section__head">
          <span>{{ t('travel.saved') }}</span><span class="tab__count">{{ spots.length }}</span>
        </div>
        <div class="section__body">
          <DataTable
            v-model:sort="spotView.sort"
            v-model:page="spotView.page"
            v-model:per-page="spotView.perPage"
            v-model:widths="spotView.widths"
            :columns="spotColumns"
            :rows="spotRows"
            row-key="key"
            :empty-text="t('travel.noSaved')"
          >
            <template #name="{ row }">
              <ValueInput
                :value="row.name"
                text
                :title="t('travel.renameHint')"
                @commit="spots = rename(spots, row.key, $event)"
              />
            </template>
            <template #coord="{ row }">
              <span class="mono faint">{{ row.x }}, {{ row.y }}</span>
            </template>
            <template #actions="{ row }">
              <div class="btn-group">
                <button class="btn btn--sm btn--primary" @click="goTo(row.mapId, row.x, row.y)">
                  {{ t('common.go') }}
                </button>
                <button class="btn btn--sm btn--icon btn--danger" :title="t('common.delete')" @click="removeSpot(row)">
                  <AppIcon name="trash" :size="13" />
                </button>
              </div>
            </template>
          </DataTable>
        </div>
      </div>

      <div class="section">
        <div class="section__head">
          <span>{{ t('travel.visited') }}</span><span class="tab__count">{{ recent.length }}</span>
          <span class="spacer" />
          <span class="hint">{{ t('travel.lead') }}</span>
        </div>
        <div class="section__body">
          <DataTable
            v-model:sort="visitView.sort"
            v-model:page="visitView.page"
            v-model:per-page="visitView.perPage"
            v-model:widths="visitView.widths"
            :columns="visitColumns"
            :rows="recent"
            row-key="key"
            :empty-text="t('travel.noVisited')"
          >
            <template #coord="{ row }">
              <span class="mono faint">{{ row.x }}, {{ row.y }}</span>
            </template>
            <template #actions="{ row }">
              <button class="btn btn--sm" @click="goTo(row.mapId, row.x, row.y)">{{ t('common.go') }}</button>
            </template>
          </DataTable>
        </div>
      </div>

      <details class="more">
        <summary>{{ t('travel.allMaps') }}</summary>

        <div class="row-wrap" style="margin-bottom: 8px">
          <span class="field__label">{{ t('travel.coordHint') }}</span>
          <ValueInput :value="target.x" :width="64" @commit="target.x = $event" />
          <ValueInput :value="target.y" :width="64" @commit="target.y = $event" />
          <button class="btn btn--sm btn--icon" :title="t('travel.useCurrent')" @click="useCurrentCoord">
            <AppIcon name="crosshair" :size="13" />
          </button>
        </div>

        <SearchBox
          v-model="view.search"
          :placeholder="t('travel.mapSearch')"
          :shown="shownMaps.length"
          :total="maps.length"
        />

        <DataTable
          v-model:sort="view.sort"
          v-model:page="view.page"
          v-model:per-page="view.perPage"
          v-model:widths="view.widths"
          style="margin-top: 8px"
          :columns="mapColumns"
          :rows="shownMaps"
          :empty-text="t('travel.emptyMaps')"
        >
          <template #id="{ row }">
            <span class="cell-id">{{ row.id }}</span>
          </template>
          <template #name="{ row }">
            <span :class="{ faint: !row.name }">{{ row.name || t('common.unnamed') }}</span>
          </template>
          <template #path="{ row }">
            <span class="faint">{{ row.path }}</span>
          </template>
          <template #actions="{ row }">
            <button class="btn btn--sm" :title="t('travel.goTitle', { x: target.x, y: target.y })" @click="warp(row)">
              {{ t('common.go') }}
            </button>
          </template>
        </DataTable>
      </details>
    </div>
  </div>
</template>
