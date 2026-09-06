<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import CheckBox from '@/shared/ui/CheckBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { battle, encounters } from '@/engine/cheats'
import { troopMembers } from '@/engine/globals'
import type { Battler } from '@/engine/types'
import { clamp, toInt } from '@/shared/lib/coerce'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { t, type MessageKey } from '@/i18n'

interface EnemyRow {
  key: string
  name: string
  hp: number
  mhp: number
  tp: number
  mtp: number
  member: Battler
}

const columns = computed<Column[]>(() => [
  { key: 'name', label: t('col.name'), width: 200 },
  { key: 'hp', label: 'HP', width: 180, align: 'right' },
  { key: 'tp', label: 'TP', width: 180, align: 'right' },
  { key: 'actions', label: '', width: 90, sortable: false }
])

const view = useSession().view('combat', { sort: { key: 'key', desc: false }, widths: { name: 200 } })

const enemies = ref<EnemyRow[]>([])
const inBattle = ref(false)
const noEncounter = ref(false)

onMounted(refresh)

function refresh(): void {
  enemies.value = troopMembers().map((member, index) => ({
    key: `e${index}`,
    member,
    name: member.name?.() ?? '',
    hp: member.hp,
    mhp: member.mhp,
    tp: member.tp,
    mtp: member.maxTp?.() ?? 100
  }))

  inBattle.value = battle.inBattle()
  noEncounter.value = encounters.disabled()
}

function setPool(row: EnemyRow, field: 'hp' | 'tp', raw: string | number): void {
  const value = toInt(raw)

  if (value !== null) {
    const max = field === 'hp' ? row.mhp : row.mtp
    const setter = field === 'hp' ? row.member.setHp : row.member.setTp
    setter.call(row.member, clamp(value, 0, max))
  }

  refresh()
}

function bulk(run: () => void, key: MessageKey): void {
  run()
  refresh()
  toast.success(t(key))
}

function finish(kind: 'victory' | 'defeat' | 'escape' | 'abort'): void {
  if (battle.finish(kind)) toast.success(t('combat.finished', { kind: t(`combat.${kind}`) }))
  else toast.warn(t('toast.onlyInBattle'))

  refresh()
}

function toggleEncounters(): void {
  encounters.toggle()
  refresh()
}
</script>

<template>
  <div class="content">
    <div class="strip">
      <span class="status">
        <span class="dot" :class="inBattle ? 'dot-danger' : 'dot-muted'" />
        {{ t(inBattle ? 'combat.inBattle' : 'combat.notInBattle') }}
      </span>
      <span class="spacer" />
      <span class="hint">{{ t('combat.lead') }}</span>
      <button class="btn btn--sm btn--icon" :title="t('common.refresh')" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <div class="section">
        <div class="section__head">{{ t('combat.encounters') }}</div>
        <div class="section__body row-wrap">
          <CheckBox v-model="noEncounter" :label="t('combat.noEncounter')" @update:model-value="toggleEncounters" />
          <button class="btn" @click="bulk(battle.forceEncounter, 'toast.encounterForced')">
            {{ t('combat.forceEncounter') }}
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section__head">{{ t('combat.endBattle') }}</div>
        <div class="section__body">
          <div class="btn-group">
            <button class="btn btn--primary" :disabled="!inBattle" @click="finish('victory')">
              {{ t('combat.victory') }}
            </button>
            <button class="btn" :disabled="!inBattle" @click="finish('escape')">{{ t('combat.escape') }}</button>
            <button class="btn" :disabled="!inBattle" @click="finish('abort')">{{ t('combat.abort') }}</button>
            <button class="btn btn--danger" :disabled="!inBattle" @click="finish('defeat')">
              {{ t('combat.defeat') }}
            </button>
          </div>
          <div v-if="!inBattle" class="hint" style="margin-top: 6px">{{ t('combat.onlyInBattle') }}</div>
        </div>
      </div>

      <div class="section">
        <div class="section__head">
          <span>{{ t('combat.enemies') }}</span><span class="tab__count">{{ enemies.length }}</span>
          <span class="spacer" />
          <div class="btn-group">
            <button
              class="btn btn--sm"
              :disabled="enemies.length === 0"
              @click="bulk(() => battle.recoverAll(troopMembers()), 'combat.healEnemies')"
            >
              {{ t('combat.healEnemies') }}
            </button>
            <button
              class="btn btn--sm"
              :disabled="enemies.length === 0"
              @click="bulk(() => battle.setHpAll(troopMembers(), 1), 'combat.weaken')"
            >
              {{ t('combat.weaken') }}
            </button>
            <button
              class="btn btn--sm btn--danger"
              :disabled="enemies.length === 0"
              @click="bulk(() => battle.setHpAll(troopMembers(), 0), 'combat.wipe')"
            >
              {{ t('combat.wipe') }}
            </button>
          </div>
        </div>
        <div class="section__body">
          <DataTable
            v-model:sort="view.sort"
            v-model:page="view.page"
            v-model:per-page="view.perPage"
            v-model:widths="view.widths"
            :columns="columns"
            :rows="enemies"
            row-key="key"
            :empty-text="t('combat.noEnemies')"
          >
            <template #hp="{ row }">
              <div class="row">
                <ValueInput :value="row.hp" :width="80" @commit="setPool(row, 'hp', $event)" />
                <span class="mono faint nowrap">/ {{ row.mhp }}</span>
              </div>
            </template>
            <template #tp="{ row }">
              <div class="row">
                <ValueInput :value="row.tp" :width="80" @commit="setPool(row, 'tp', $event)" />
                <span class="mono faint nowrap">/ {{ row.mtp }}</span>
              </div>
            </template>
            <template #actions="{ row }">
              <button class="btn btn--sm btn--danger" @click="setPool(row, 'hp', 0)">{{ t('combat.wipe') }}</button>
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>
