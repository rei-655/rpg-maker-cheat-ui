<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import CheckBox from '@/shared/ui/CheckBox.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import KeyCapture from './KeyCapture.vue'
import { ACTIONS } from '@/app/actions'
import { formatCombo } from '@/app/keys'
import { engineName, settingsFile } from '@/engine/engine'
import { matches, parseQuery } from '@/shared/lib/query'
import { toInt } from '@/shared/lib/coerce'
import { confirm } from '@/shared/composables/useConfirm'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { useShortcuts } from '@/stores/shortcuts'
import { LOCALES, locale, setLocale, t, type Locale } from '@/i18n'

const TABS = ['shortcuts', 'general'] as const

const columns = computed<Column[]>(() => [
  { key: 'label', label: t('col.action'), width: 240 },
  { key: 'combo', label: t('col.combo'), width: 190 },
  { key: 'slot', label: t('col.slot'), width: 90, align: 'right' },
  { key: 'hint', label: '' }
])

const session = useSession()
const shortcuts = useShortcuts()
const view = session.view('settings', { tab: 'shortcuts', perPage: 0, widths: { label: 240, combo: 190 } })

const search = ref('')

const rows = computed(() => {
  const query = parseQuery(search.value)

  return ACTIONS.map((action) => ({
    id: action.id,
    label: t(action.labelKey),
    hint: action.hintKey ? t(action.hintKey) : '',
    slot: action.slot === undefined ? null : shortcuts.binding(action.id).slot,
    combo: shortcuts.binding(action.id).combo
  })).filter(
    (row) =>
      (!view.flags.assignedOnly || row.combo) &&
      matches(query, { id: row.id, texts: [row.label, row.hint, formatCombo(row.combo)] })
  )
})

function rebind(id: string, combo: string): void {
  const error = shortcuts.rebind(id, combo)
  if (error) toast.warn(error)
}

function setSlot(id: string, raw: string): void {
  const slot = toInt(raw)
  if (slot !== null) shortcuts.setSlot(id, Math.max(1, slot))
}

async function restore(): Promise<void> {
  const ok = await confirm({
    title: t('settings.restoreTitle'),
    message: t('settings.restoreMessage'),
    confirmText: t('common.reset'),
    danger: true
  })

  if (ok) {
    shortcuts.restoreDefaults()
    toast.success(t('settings.restoredToast'))
  }
}
</script>

<template>
  <div class="content">
    <div class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab"
        class="tab"
        :class="{ 'tab--active': tab === view.tab }"
        @click="view.tab = tab"
      >
        {{ t(`settings.${tab}`) }}
      </button>
    </div>

    <template v-if="view.tab !== 'general'">
      <div class="toolbar">
        <SearchBox
          v-model="search"
          :placeholder="t('settings.searchPlaceholder')"
          :shown="rows.length"
          :total="ACTIONS.length"
        />
        <div class="chips">
          <button
            class="chip"
            :class="{ 'chip--active': view.flags.assignedOnly }"
            @click="view.flags.assignedOnly = !view.flags.assignedOnly"
          >
            {{ t('settings.assignedOnly') }}
          </button>
        </div>
        <span class="spacer" />
        <button class="btn btn--sm" @click="restore">
          <AppIcon name="reset" :size="13" />{{ t('settings.defaults') }}
        </button>
      </div>

      <div class="content__scroll">
        <DataTable
          v-model:sort="view.sort"
          v-model:page="view.page"
          v-model:per-page="view.perPage"
          v-model:widths="view.widths"
          :columns="columns"
          :rows="rows"
          :empty-text="t('settings.emptyActions')"
        >
          <template #combo="{ row }">
            <KeyCapture :combo="row.combo" @change="rebind(row.id, $event)" />
          </template>
          <template #slot="{ row }">
            <ValueInput v-if="row.slot !== null" :value="row.slot" :width="64" @commit="setSlot(row.id, $event)" />
            <span v-else class="faint">-</span>
          </template>
          <template #hint="{ row }">
            <span class="faint">{{ row.hint }}</span>
          </template>
        </DataTable>
      </div>
    </template>

    <div v-else class="content__scroll">
      <div class="section">
        <div class="section__head">{{ t('settings.language') }}</div>
        <div class="section__body">
          <div class="chips">
            <button
              v-for="option in LOCALES"
              :key="option.code"
              class="chip"
              :class="{ 'chip--active': option.code === locale }"
              @click="setLocale(option.code as Locale)"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="hint" style="margin-top: 8px">
            {{ t('settings.languageHint', { file: settingsFile('ui.json') }) }}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head">{{ t('settings.window') }}</div>
        <div class="section__body row-wrap">
          <CheckBox v-model="session.dimmed" :label="t('settings.dim')" />
          <button class="btn" @click="session.resetGeometry()">
            <AppIcon name="reset" :size="13" />{{ t('settings.resetGeometry') }}
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section__head">{{ t('settings.info') }}</div>
        <div class="section__body">
          <div class="kv">
            <span class="kv__k">{{ t('settings.engine') }}</span><span class="mono">{{ engineName() }}</span>
            <span class="kv__k">{{ t('settings.settingsPath') }}</span
            ><span class="mono">{{ settingsFile('ui.json') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
