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

const savedColumns: Column[] = [
  { key: 'name', label: '이름' },
  { key: 'mapName', label: '맵' },
  { key: 'coord', label: '맵 · 좌표', width: 150, sortable: false },
  { key: 'actions', label: '', width: 130, sortable: false }
]

const mapColumnsAll: Column[] = [
  { key: 'id', label: 'ID', width: 64, align: 'right' },
  { key: 'name', label: '이름', width: 200 },
  { key: 'path', label: '경로' },
  { key: 'actions', label: '', width: 80, sortable: false }
]

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
  view.flags.hidePath ? mapColumnsAll.filter((column) => column.key !== 'path') : mapColumnsAll
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
  toast.success('현재 위치를 저장했다')
}

async function removeBookmark(entry: Bookmark): Promise<void> {
  const ok = await confirm({
    title: '저장 위치 삭제',
    message: `"${entry.name || '(이름 없음)'}" 을 삭제한다.`,
    confirmText: '삭제',
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
        현재 <b>{{ current.path || '알 수 없음' }}</b>
        <span class="mono faint">({{ current.x }}, {{ current.y }})</span>
      </span>
      <span class="spacer" />
      <span class="row">
        <span class="field__label">이동 좌표</span>
        <ValueInput :value="target.x" :width="64" @commit="target.x = $event" />
        <ValueInput :value="target.y" :width="64" @commit="target.y = $event" />
        <button class="btn btn--sm btn--icon" title="현재 좌표 넣기" @click="useCurrentCoord">
          <AppIcon name="crosshair" :size="13" />
        </button>
      </span>
      <button class="btn btn--sm btn--icon" title="다시 읽기" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <div class="section">
        <div class="section__head">
          <span>저장한 위치</span><span class="tab__count">{{ bookmarks.length }}</span>
          <span class="spacer" />
          <input
            v-model="alias"
            class="input input--text"
            style="width: 160px"
            placeholder="이름 (생략 가능)"
            @keydown="onAliasKeydown"
          />
          <button class="btn btn--sm btn--primary" @click="addBookmark">
            <AppIcon name="plus" :size="13" />현재 위치 저장
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
            empty-text="현재 위치를 저장하면 여기에 표시됩니다."
          >
            <template #name="{ row }">
              <ValueInput
                :value="row.name"
                text
                title="이름을 고치고 Enter"
                @commit="bookmarks = rename(bookmarks, row.key, $event)"
              />
            </template>
            <template #coord="{ row }">
              <span class="mono faint">{{ row.mapId }} · {{ row.x }}, {{ row.y }}</span>
            </template>
            <template #actions="{ row }">
              <div class="btn-group">
                <button class="btn btn--sm" title="이 위치로 이동" @click="recall(row)">이동</button>
                <button class="btn btn--sm btn--icon btn--danger" title="삭제" @click="removeBookmark(row)">
                  <AppIcon name="trash" :size="13" />
                </button>
              </div>
            </template>
          </DataTable>
        </div>
      </div>

      <div class="section">
        <div class="section__head">
          <span>맵</span>
          <span class="spacer" />
          <CheckBox v-model="view.flags.hidePath" label="경로 숨기기" />
        </div>
        <div class="section__body">
          <SearchBox
            v-model="view.search"
            placeholder="맵 이름 · 경로 · #12"
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
            empty-text="조건에 맞는 맵이 없습니다."
          >
            <template #id="{ row }">
              <span class="cell-id">{{ row.id }}</span>
            </template>
            <template #name="{ row }">
              <span :class="{ status: row.id === current.mapId }">
                <span v-if="row.id === current.mapId" class="dot dot-ok" />
                {{ row.name || '(이름 없음)' }}
              </span>
            </template>
            <template #path="{ row }">
              <span class="faint">{{ row.path }}</span>
            </template>
            <template #actions="{ row }">
              <button class="btn btn--sm" :title="`(${target.x}, ${target.y}) 로 이동`" @click="warp(row)">
                이동
              </button>
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>
