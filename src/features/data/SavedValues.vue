<script setup lang="ts">
import { computed, onMounted } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import { switchNames, variableNames } from '@/engine/globals'
import { toast } from '@/shared/composables/useToast'
import { useWatches } from '@/stores/watches'
import type { WatchRow } from './watchlist'
import { t } from '@/i18n'

/** ホームでは行数を絞り、名前の変更と削除は出さない。誤操作を避ける。 */
const { compact = false, limit = 0 } = defineProps<{ compact?: boolean; limit?: number }>()
const emit = defineEmits<{ open: [WatchRow]; more: [] }>()

const store = useWatches()

const shown = computed(() => (limit > 0 ? store.rows.slice(0, limit) : store.rows))
const overflow = computed(() => Math.max(0, store.rows.length - shown.value.length))

onMounted(store.refresh)

/** 出どころを一目で言い当てる。変数なら番号とツクール側の名前を添える。 */
function source(row: WatchRow): string {
  if (row.kind === 'variable') return label(t('watch.variable', { id: row.id }), variableNames()[row.id])
  if (row.kind === 'switch') return label(t('watch.switch', { id: row.id }), switchNames()[row.id])

  return row.ref
}

function label(prefix: string, name: string | undefined): string {
  return name ? `${prefix} · ${name}` : prefix
}

function commit(row: WatchRow, raw: string): void {
  if (!store.commit(row, raw)) toast.warn(t('finder.writeFailed'))
}

function toggle(row: WatchRow): void {
  commit(row, row.field.value === true ? 'false' : 'true')
}
</script>

<template>
  <div v-if="store.rows.length === 0" class="empty">{{ t('finder.noSaved') }}</div>

  <div v-else class="table-wrap">
    <table class="table">
      <colgroup>
        <col :style="{ width: compact ? '160px' : '200px' }" />
        <col v-if="!compact" />
        <col style="width: 140px" />
        <col v-if="!compact" style="width: 44px" />
      </colgroup>
      <thead>
        <tr>
          <th>{{ t('col.name') }}</th>
          <th v-if="!compact">{{ t('col.where') }}</th>
          <th class="num">{{ t('col.value') }}</th>
          <th v-if="!compact" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in shown" :key="row.key">
          <td>
            <ValueInput v-if="!compact" :value="row.name" text @commit="store.setName(row.key, $event)" />
            <span v-else class="nowrap" :title="source(row)">{{ row.name }}</span>
          </td>

          <td v-if="!compact">
            <span class="mono faint link" :title="t('finder.openSaved')" @click="emit('open', row)">
              {{ source(row) }}
            </span>
          </td>

          <td class="num">
            <button v-if="row.found && row.field.kind === 'boolean'" class="btn btn--sm" @click="toggle(row)">
              <span class="dot" :class="row.field.value === true ? 'dot-ok' : 'dot-muted'" />
              {{ t(row.field.value === true ? 'common.on' : 'common.off') }}
            </button>
            <ValueInput
              v-else-if="row.found && row.field.editable"
              :value="row.field.text"
              :text="row.field.kind !== 'number'"
              @commit="commit(row, $event)"
            />
            <span v-else-if="row.found" class="mono faint">{{ row.field.text }}</span>
            <span v-else class="pill pill--warn">{{ t('finder.missing') }}</span>
          </td>

          <td v-if="!compact">
            <button class="btn btn--sm btn--icon" :title="t('common.delete')" @click="store.drop(row.key)">
              <AppIcon name="trash" :size="13" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="compact && overflow > 0" class="row" style="margin-top: 8px">
    <button class="btn btn--sm" @click="emit('more')">{{ t('watch.more', { count: overflow }) }}</button>
  </div>
</template>
