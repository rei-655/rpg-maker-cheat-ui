<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import CheckBox from '@/shared/ui/CheckBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { battle, encounters } from '@/engine/cheats'
import { partyMembers, troopMembers } from '@/engine/globals'
import type { Battler } from '@/engine/types'
import { clamp, toInt } from '@/shared/lib/coerce'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { t, type MessageKey } from '@/i18n'

type Side = 'party' | 'enemy'

interface Row {
  key: string
  side: Side
  name: string
  hp: number
  mhp: number
  mp: number
  mmp: number
  tp: number
  mtp: number
  member: Battler
}

const columns = computed<Column[]>(() => [
  { key: 'side', label: t('col.side'), width: 70 },
  { key: 'name', label: t('col.name'), width: 160 },
  { key: 'hp', label: 'HP', width: 170, align: 'right' },
  { key: 'mp', label: 'MP', width: 170, align: 'right' },
  { key: 'tp', label: 'TP', width: 170, align: 'right' },
  { key: 'actions', label: '', width: 110, sortable: false }
])

const view = useSession().view('battle', {
  sort: { key: 'key', desc: false },
  widths: { side: 70, name: 160 }
})

const rows = ref<Row[]>([])
const inBattle = ref(false)
const noEncounter = ref(false)

onMounted(refresh)

function refresh(): void {
  rows.value = [
    ...partyMembers().map((member, index) => describe(member, `party-${index}`, 'party')),
    ...troopMembers().map((member, index) => describe(member, `enemy-${index}`, 'enemy'))
  ]

  inBattle.value = battle.inBattle()
  noEncounter.value = encounters.disabled()
}

function describe(member: Battler, key: string, side: Side): Row {
  return {
    key,
    side,
    member,
    name: member.name?.() ?? '',
    hp: member.hp,
    mhp: member.mhp,
    mp: member.mp,
    mmp: member.mmp,
    tp: member.tp,
    mtp: member.maxTp?.() ?? 100
  }
}

function commit(row: Row, field: 'hp' | 'mp' | 'tp', raw: string | number): void {
  const value = toInt(raw)

  if (value !== null) {
    const max = { hp: row.mhp, mp: row.mmp, tp: row.mtp }[field]
    const setter = { hp: row.member.setHp, mp: row.member.setMp, tp: row.member.setTp }[field]
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
  if (battle.finish(kind)) toast.success(t('toast.battleFinished', { kind: t(`battle.${kind}`) }))
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
        {{ t(inBattle ? 'battle.inBattle' : 'battle.notInBattle') }}
      </span>
      <CheckBox v-model="noEncounter" :label="t('battle.noEncounter')" @update:model-value="toggleEncounters" />
      <span class="spacer" />
      <button class="btn btn--sm btn--icon" :title="t('common.refresh')" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <div class="section">
        <div class="section__head">{{ t('battle.section') }}</div>
        <div class="section__body">
          <div class="row-wrap">
            <button class="btn" @click="bulk(battle.forceEncounter, 'toast.encounterForced')">
              {{ t('battle.encounter') }}
            </button>
            <span class="chips__sep" />
            <button class="btn" :disabled="!inBattle" @click="finish('victory')">{{ t('battle.victory') }}</button>
            <button class="btn" :disabled="!inBattle" @click="finish('defeat')">{{ t('battle.defeat') }}</button>
            <button class="btn" :disabled="!inBattle" @click="finish('escape')">{{ t('battle.escape') }}</button>
            <button class="btn" :disabled="!inBattle" @click="finish('abort')">{{ t('battle.abort') }}</button>
          </div>
          <div v-if="!inBattle" class="hint" style="margin-top: 6px">
            {{ t('battle.onlyInBattle') }}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head">{{ t('battle.bulk') }}</div>
        <div class="section__body">
          <div class="row-wrap">
            <span class="chips__label" style="width: 40px">{{ t('common.party') }}</span>
            <button class="btn btn--sm" @click="bulk(() => battle.recoverAll(partyMembers()), 'action.partyRecover')">
              {{ t('battle.recoverAll') }}
            </button>
            <button class="btn btn--sm" @click="bulk(() => battle.fillTpAll(partyMembers()), 'battle.fillTp')">
              {{ t('battle.fillTp') }}
            </button>
            <button class="btn btn--sm" @click="bulk(() => battle.setHpAll(partyMembers(), 1), 'action.partyWound')">
              {{ t('battle.hp1') }}
            </button>
          </div>
          <div class="row-wrap" style="margin-top: 6px">
            <span class="chips__label" style="width: 40px">{{ t('common.enemy') }}</span>
            <button class="btn btn--sm" @click="bulk(() => battle.recoverAll(troopMembers()), 'action.enemyRecover')">
              {{ t('battle.recoverAll') }}
            </button>
            <button class="btn btn--sm" @click="bulk(() => battle.fillTpAll(troopMembers()), 'battle.fillTp')">
              {{ t('battle.fillTp') }}
            </button>
            <button class="btn btn--sm" @click="bulk(() => battle.setHpAll(troopMembers(), 1), 'action.enemyWound')">
              {{ t('battle.hp1') }}
            </button>
            <button
              class="btn btn--sm btn--danger"
              @click="bulk(() => battle.setHpAll(troopMembers(), 0), 'battle.hp0')"
            >
              {{ t('battle.hp0') }}
            </button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head">
          <span>{{ t('battle.members') }}</span><span class="tab__count">{{ rows.length }}</span>
        </div>
        <div class="section__body">
          <DataTable
            v-model:sort="view.sort"
            v-model:page="view.page"
            v-model:per-page="view.perPage"
            v-model:widths="view.widths"
            :columns="columns"
            :rows="rows"
            row-key="key"
            :empty-text="t('battle.emptyMembers')"
          >
            <template #side="{ row }">
              <span class="pill" :class="row.side === 'party' ? 'pill--accent' : 'pill--danger'">
                {{ t(row.side === 'party' ? 'common.party' : 'common.enemy') }}
              </span>
            </template>
            <template #hp="{ row }">
              <div class="row">
                <ValueInput :value="row.hp" :width="72" @commit="commit(row, 'hp', $event)" />
                <span class="mono faint nowrap">/ {{ row.mhp }}</span>
              </div>
            </template>
            <template #mp="{ row }">
              <div class="row">
                <ValueInput :value="row.mp" :width="72" @commit="commit(row, 'mp', $event)" />
                <span class="mono faint nowrap">/ {{ row.mmp }}</span>
              </div>
            </template>
            <template #tp="{ row }">
              <div class="row">
                <ValueInput :value="row.tp" :width="72" @commit="commit(row, 'tp', $event)" />
                <span class="mono faint nowrap">/ {{ row.mtp }}</span>
              </div>
            </template>
            <template #actions="{ row }">
              <div class="btn-group">
                <button
                  class="btn btn--sm"
                  :title="t('battle.recoverTitle')"
                  @click="bulk(() => battle.recover(row.member), 'battle.recover')"
                >
                  {{ t('battle.recover') }}
                </button>
                <button class="btn btn--sm btn--danger" :title="t('battle.hp1Title')" @click="commit(row, 'hp', 1)">
                  1
                </button>
              </div>
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>
