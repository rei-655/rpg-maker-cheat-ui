<script setup lang="ts">
import { onMounted, ref } from 'vue'
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

type Side = '아군' | '적'

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

const columns: Column[] = [
  { key: 'side', label: '진영', width: 70 },
  { key: 'name', label: '이름', width: 160 },
  { key: 'hp', label: 'HP', width: 170, align: 'right' },
  { key: 'mp', label: 'MP', width: 170, align: 'right' },
  { key: 'tp', label: 'TP', width: 170, align: 'right' },
  { key: 'actions', label: '', width: 110, sortable: false }
]

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
    ...partyMembers().map((member, index) => describe(member, `party-${index}`, '아군')),
    ...troopMembers().map((member, index) => describe(member, `enemy-${index}`, '적'))
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

function bulk(run: () => void, message: string): void {
  run()
  refresh()
  toast.success(message)
}

function finish(kind: 'victory' | 'defeat' | 'escape' | 'abort'): void {
  if (battle.finish(kind)) toast.success(`전투 ${kind}`)
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
        {{ inBattle ? '전투 중' : '전투 아님' }}
      </span>
      <CheckBox v-model="noEncounter" label="랜덤 인카운터 정지" @update:model-value="toggleEncounters" />
      <span class="spacer" />
      <button class="btn btn--sm btn--icon" title="다시 읽기" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <div class="section">
        <div class="section__head">전투</div>
        <div class="section__body">
          <div class="row-wrap">
            <button class="btn" @click="bulk(battle.forceEncounter, '다음 걸음에 전투가 발생한다')">
              인카운터 발생
            </button>
            <span class="chips__sep" />
            <button class="btn" :disabled="!inBattle" @click="finish('victory')">승리</button>
            <button class="btn" :disabled="!inBattle" @click="finish('defeat')">패배</button>
            <button class="btn" :disabled="!inBattle" @click="finish('escape')">도주</button>
            <button class="btn" :disabled="!inBattle" @click="finish('abort')">중단</button>
          </div>
          <div v-if="!inBattle" class="hint" style="margin-top: 6px">
            승리 · 패배 · 도주 · 중단은 전투 중에만 쓸 수 있습니다.
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head">일괄</div>
        <div class="section__body">
          <div class="row-wrap">
            <span class="chips__label" style="width: 40px">아군</span>
            <button class="btn btn--sm" @click="bulk(() => battle.recoverAll(partyMembers()), '아군 전체 회복')">
              전체 회복
            </button>
            <button class="btn btn--sm" @click="bulk(() => battle.fillTpAll(partyMembers()), '아군 TP 최대')">
              TP 최대
            </button>
            <button class="btn btn--sm" @click="bulk(() => battle.setHpAll(partyMembers(), 1), '아군 HP 1')">
              HP 1
            </button>
          </div>
          <div class="row-wrap" style="margin-top: 6px">
            <span class="chips__label" style="width: 40px">적</span>
            <button class="btn btn--sm" @click="bulk(() => battle.recoverAll(troopMembers()), '적 전체 회복')">
              전체 회복
            </button>
            <button class="btn btn--sm" @click="bulk(() => battle.fillTpAll(troopMembers()), '적 TP 최대')">
              TP 최대
            </button>
            <button class="btn btn--sm" @click="bulk(() => battle.setHpAll(troopMembers(), 1), '적 HP 1')">
              HP 1
            </button>
            <button
              class="btn btn--sm btn--danger"
              @click="bulk(() => battle.setHpAll(troopMembers(), 0), '적 HP 0')"
            >
              HP 0
            </button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head">
          <span>멤버</span><span class="tab__count">{{ rows.length }}</span>
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
            empty-text="표시할 멤버가 없습니다."
          >
            <template #side="{ row }">
              <span class="pill" :class="row.side === '아군' ? 'pill--accent' : 'pill--danger'">{{ row.side }}</span>
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
                <button class="btn btn--sm" title="HP · MP · TP 최대" @click="bulk(() => battle.recover(row.member), '회복')">
                  회복
                </button>
                <button class="btn btn--sm btn--danger" title="HP 1" @click="commit(row, 'hp', 1)">1</button>
              </div>
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>
