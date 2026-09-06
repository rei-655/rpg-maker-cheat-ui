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
import { t } from '@/i18n'

interface Row {
  id: number
  name: string
  value: boolean
}

const columns = computed<Column[]>(() => [
  { key: 'id', label: t('col.id'), width: 64, align: 'right' },
  { key: 'name', label: t('col.name'), width: 320 },
  { key: 'value', label: t('col.value'), width: 96 }
])

const view = useSession().view('data.switches', { perPage: 25, widths: { id: 64, name: 320 } })
const rows = ref<Row[]>([])

const shown = computed(() => {
  const query = parseQuery(view.search)

  return rows.value.filter(
    (row) =>
      (!view.flags.named || row.name) &&
      (!view.flags.onlyOn || row.value) &&
      matches(query, { id: row.id, value: row.value, texts: [row.name] })
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
  const state = t(value ? 'common.on' : 'common.off')

  const ok = await confirm({
    title: t(value ? 'data.allOn' : 'data.allOff'),
    message: t('data.bulkMessage', { count: targets.length, state }),
    confirmText: state,
    danger: true
  })

  if (!ok) return

  for (const row of targets) {
    switches().setValue(row.id, value)
    row.value = value
  }

  toast.success(t('data.bulkToast', { count: targets.length, state }))
}
</script>

<template>
  <div>
    <div class="toolbar">
      <SearchBox
        v-model="view.search"
        :placeholder="t('data.switchSearch')"
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
          :class="{ 'chip--active': view.flags.onlyOn }"
          @click="view.flags.onlyOn = !view.flags.onlyOn"
        >
          {{ t('data.onlyOn') }}
        </button>
      </div>

      <span class="spacer" />
      <button class="btn btn--sm" :disabled="shown.length === 0" @click="setAll(true)">{{ t('data.allOn') }}</button>
      <button class="btn btn--sm" :disabled="shown.length === 0" @click="setAll(false)">{{ t('data.allOff') }}</button>
      <button class="btn btn--sm btn--icon" :title="t('common.refresh')" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <DataTable
      v-model:sort="view.sort"
      v-model:page="view.page"
      v-model:per-page="view.perPage"
      v-model:widths="view.widths"
      style="margin-top: 8px"
      :columns="columns"
      :rows="shown"
      :empty-text="t('data.emptySwitches')"
    >
      <template #id="{ row }">
        <span class="cell-id">{{ row.id }}</span>
      </template>
      <template #name="{ row }">
        <span :class="{ faint: !row.name }">{{ row.name || t('common.unnamed') }}</span>
      </template>
      <template #value="{ row }">
        <button class="btn btn--sm" :title="t(row.value ? 'data.turnOff' : 'data.turnOn')" @click="toggle(row)">
          <span class="dot" :class="row.value ? 'dot-ok' : 'dot-muted'" />
          {{ t(row.value ? 'common.on' : 'common.off') }}
        </button>
      </template>
    </DataTable>
  </div>
</template>
