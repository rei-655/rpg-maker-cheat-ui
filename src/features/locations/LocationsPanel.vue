<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import CheckBox from '@/shared/ui/CheckBox.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { currentMapId, has, player } from '@/engine/globals'
import { listMaps, mapPath, teleport, type MapEntry } from '@/engine/maps'
import { matches, parseQuery } from '@/shared/lib/query'
import { toInt } from '@/shared/lib/coerce'
import { addCurrent, load, remove, rename, type Bookmark } from './bookmarks'
import { confirm } from '@/shared/composables/useConfirm'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { t } from '@/i18n'

const savedColumns = computed<Column[]>(() => [
  { key: 'name', label: t('col.name') },
  { key: 'mapName', label: t('col.map') },
  { key: 'coord', label: t('col.coord'), width: 150, sortable: false },
  { key: 'actions', label: '', width: 130, sortable: false }
])

const mapColumnsAll = computed<Column[]>(() => [
  { key: 'id', label: t('col.id'), width: 64, align: 'right' },
  { key: 'name', label: t('col.name'), width: 200 },
  { key: 'path', label: t('col.path') },
  { key: 'actions', label: '', width: 80, sortable: false }
])

const session = useSession()
const view = session.view('locations', { perPage: 15, widths: { id: 64, name: 200 } })
const savedView = session.view('locations.saved', {
  sort: { key: 'name', desc: false },
  perPage: 15,
  widths: { coord: 150, actions: 130 }
})

const maps = ref<MapEntry[]>([])
const bookmarks = ref<Bookmark[]>([])
const alias = ref('')
const target = reactive({ x: '0', y: '0' })
const current = reactive({ mapId: 0, path: '', x: 0, y: 0 })

const mapColumns = computed(() =>
  view.flags.hidePath ? mapColumnsAll.value.filter((column) => column.key !== 'path') : mapColumnsAll.value
)

const shownMaps = computed(() => {
  const query = parseQuery(view.search)
  return maps.value.filter((map) => matches(query, { id: map.id, value: map.id, texts: [map.name, map.path] }))
})

const savedRows = computed(() =>
  bookmarks.value.map((entry) => ({
    ...entry,
    mapName: mapPath(entry.mapId) || `#${entry.mapId}`
  }))
)

onMounted(refresh)

function refresh(): void {
  maps.value = listMaps()
  bookmarks.value = load()
  readCurrent()
}

function readCurrent(): void {
  current.mapId = currentMapId()
  current.path = mapPath(current.mapId)
  current.x = has('$gamePlayer') ? player().x : 0
  current.y = has('$gamePlayer') ? player().y : 0
}

function useCurrentCoord(): void {
  readCurrent()
  target.x = String(current.x)
  target.y = String(current.y)
}

function warp(map: MapEntry): void {
  teleport(map.id, toInt(target.x, 0)!, toInt(target.y, 0)!)
  readCurrent()
}

function recall(entry: Bookmark): void {
  teleport(entry.mapId, entry.x, entry.y)
  readCurrent()
}

function onAliasKeydown(event: KeyboardEvent): void {
  event.stopPropagation()

  if (event.key === 'Enter') {
    event.preventDefault()
    addBookmark()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    alias.value = ''
  }
}

function addBookmark(): void {
  bookmarks.value = addCurrent(bookmarks.value, alias.value)
  alias.value = ''
  toast.success(t('locations.savedToast'))
}

async function removeBookmark(entry: Bookmark): Promise<void> {
  const ok = await confirm({
    title: t('locations.deleteTitle'),
    message: t('locations.deleteMessage', { name: entry.name || t('common.unnamed') }),
    confirmText: t('common.delete'),
    danger: true
  })

  if (ok) bookmarks.value = remove(bookmarks.value, entry.key)
}
</script>

<template>
  <div class="content">
    <div class="strip">
      <span class="status">
        <span class="dot dot-ok" />
        {{ t('locations.current') }} <b>{{ current.path || t('common.unknown') }}</b>
        <span class="mono faint">({{ current.x }}, {{ current.y }})</span>
      </span>
      <span class="spacer" />
      <span class="row">
        <span class="field__label">{{ t('locations.targetCoord') }}</span>
        <ValueInput :value="target.x" :width="64" @commit="target.x = $event" />
        <ValueInput :value="target.y" :width="64" @commit="target.y = $event" />
        <button class="btn btn--sm btn--icon" :title="t('locations.useCurrent')" @click="useCurrentCoord">
          <AppIcon name="crosshair" :size="13" />
        </button>
      </span>
      <button class="btn btn--sm btn--icon" :title="t('common.refresh')" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <div class="section">
        <div class="section__head">
          <span>{{ t('locations.saved') }}</span><span class="tab__count">{{ bookmarks.length }}</span>
          <span class="spacer" />
          <input
            v-model="alias"
            class="input input--text"
            style="width: 160px"
            :placeholder="t('locations.aliasPlaceholder')"
            @keydown="onAliasKeydown"
          />
          <button class="btn btn--sm btn--primary" @click="addBookmark">
            <AppIcon name="plus" :size="13" />{{ t('locations.saveCurrent') }}
          </button>
        </div>
        <div class="section__body">
          <DataTable
            v-model:sort="savedView.sort"
            v-model:page="savedView.page"
            v-model:per-page="savedView.perPage"
            v-model:widths="savedView.widths"
            :columns="savedColumns"
            :rows="savedRows"
            row-key="key"
            :empty-text="t('locations.emptySaved')"
          >
            <template #name="{ row }">
              <ValueInput
                :value="row.name"
                text
                :title="t('locations.renameHint')"
                @commit="bookmarks = rename(bookmarks, row.key, $event)"
              />
            </template>
            <template #coord="{ row }">
              <span class="mono faint">{{ row.mapId }} · {{ row.x }}, {{ row.y }}</span>
            </template>
            <template #actions="{ row }">
              <div class="btn-group">
                <button class="btn btn--sm" :title="t('locations.recall')" @click="recall(row)">{{ t('locations.recall') }}</button>
                <button class="btn btn--sm btn--icon btn--danger" :title="t('common.delete')" @click="removeBookmark(row)">
                  <AppIcon name="trash" :size="13" />
                </button>
              </div>
            </template>
          </DataTable>
        </div>
      </div>

      <div class="section">
        <div class="section__head">
          <span>{{ t('locations.maps') }}</span>
          <span class="spacer" />
          <CheckBox v-model="view.flags.hidePath" :label="t('locations.hidePath')" />
        </div>
        <div class="section__body">
          <SearchBox
            v-model="view.search"
            :placeholder="t('locations.searchPlaceholder')"
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
            :empty-text="t('locations.emptyMaps')"
          >
            <template #id="{ row }">
              <span class="cell-id">{{ row.id }}</span>
            </template>
            <template #name="{ row }">
              <span :class="{ status: row.id === current.mapId }">
                <span v-if="row.id === current.mapId" class="dot dot-ok" />
                {{ row.name || t('common.unnamed') }}
              </span>
            </template>
            <template #path="{ row }">
              <span class="faint">{{ row.path }}</span>
            </template>
            <template #actions="{ row }">
              <button class="btn btn--sm" :title="t('locations.warpTitle', { x: target.x, y: target.y })" @click="warp(row)">
                {{ t('common.move') }}
              </button>
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>
