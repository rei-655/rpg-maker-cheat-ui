<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { switchNames, switches } from '@/engine/globals'
import { matches, parseQuery } from '@/shared/lib/query'
import { confirm } from '@/shared/composables/useConfirm'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'

interface Row {
  id: number
  name: string
  value: boolean
}

const columns: Column[] = [
  { key: 'id', label: 'ID', width: 64, align: 'right' },
  { key: 'name', label: '이름', width: 320 },
  { key: 'value', label: '상태', width: 96 }
]

const view = useSession().view('switches', { perPage: 25, widths: { id: 64, name: 320 } })
const rows = ref<Row[]>([])

const shown = computed(() => {
  const query = parseQuery(view.search)

  return rows.value.filter(
    (row) => (!view.flags.named || row.name) && matches(query, { id: row.id, value: row.value, texts: [row.name] })
  )
})

onMounted(refresh)

function refresh(): void {
  rows.value = switchNames()
    .map((name, id) => ({ id, name: name ?? '', value: id > 0 && switches().value(id) }))
    .slice(1)
}

function toggle(row: Row): void {
  switches().setValue(row.id, !row.value)
  row.value = switches().value(row.id)
}

async function setAll(value: boolean): Promise<void> {
  const targets = [...shown.value]
  const label = value ? 'ON' : 'OFF'

  const ok = await confirm({
    title: `스위치 일괄 ${label}`,
    message: `현재 목록의 ${targets.length}개를 모두 ${label} 으로 바꾼다.`,
    confirmText: label,
    danger: true
  })

  if (!ok) return

  for (const row of targets) {
    switches().setValue(row.id, value)
    row.value = value
  }

  toast.success(`${targets.length}개를 ${label} 으로 바꿨다`)
}
</script>

<template>
  <div class="content">
    <div class="toolbar">
      <SearchBox
        v-model="view.search"
        placeholder="이름 · #12 · on · off"
        :shown="shown.length"
        :total="rows.length"
        autofocus
      />

      <div class="chips">
        <button class="chip" :class="{ 'chip--active': view.flags.named }" @click="view.flags.named = !view.flags.named">
          이름 있는 것만
        </button>
      </div>

      <span class="spacer" />
      <button class="btn btn--sm" :disabled="shown.length === 0" @click="setAll(true)">전체 ON</button>
      <button class="btn btn--sm" :disabled="shown.length === 0" @click="setAll(false)">전체 OFF</button>
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
        empty-text="조건에 맞는 스위치가 없습니다."
      >
        <template #id="{ row }">
          <span class="cell-id">{{ row.id }}</span>
        </template>
        <template #name="{ row }">
          <span :class="{ faint: !row.name }">{{ row.name || '(이름 없음)' }}</span>
        </template>
        <template #value="{ row }">
          <button class="btn btn--sm" :title="row.value ? '끄기' : '켜기'" @click="toggle(row)">
            <span class="dot" :class="row.value ? 'dot-ok' : 'dot-muted'" />
            {{ row.value ? 'ON' : 'OFF' }}
          </button>
        </template>
      </DataTable>
    </div>
  </div>
</template>
