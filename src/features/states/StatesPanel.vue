<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { has, paramNames, partyMembers, rpg, troopMembers } from '@/engine/globals'
import type { Battler, DataState } from '@/engine/types'
import { matches, parseQuery } from '@/shared/lib/query'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'

interface Buff {
  paramId: number
  label: string
}

interface MemberView {
  key: string
  side: '아군' | '적'
  name: string
  states: DataState[]
  buffs: Buff[]
  member: Battler
}

const columns: Column[] = [
  { key: 'id', label: 'ID', width: 64, align: 'right' },
  { key: 'name', label: '상태' },
  { key: 'actions', label: '', width: 80, sortable: false }
]

const view = useSession().view('states', { perPage: 15, widths: { id: 64 } })
const members = ref<MemberView[]>([])
const states = ref<DataState[]>([])
const targetKey = ref('party')

const party = computed(() => members.value.filter((m) => m.side === '아군'))
const enemies = computed(() => members.value.filter((m) => m.side === '적'))

const targetOptions = computed(() => [
  { key: 'party', label: `아군 전체 (${party.value.length})` },
  { key: 'enemy', label: `적 전체 (${enemies.value.length})` },
  ...members.value.map((member) => ({ key: member.key, label: member.name }))
])

const targets = computed(() => {
  if (targetKey.value === 'party') return party.value
  if (targetKey.value === 'enemy') return enemies.value
  return members.value.filter((member) => member.key === targetKey.value)
})

const shown = computed(() => {
  const query = parseQuery(view.search)
  return states.value.filter((state) => matches(query, { id: state.id, value: state.id, texts: [state.name] }))
})

onMounted(refresh)

function refresh(): void {
  members.value = [
    ...partyMembers().map((member, index) => describe(member, `party-${index}`, '아군')),
    ...troopMembers().map((member, index) => describe(member, `enemy-${index}`, '적'))
  ]

  states.value = has('$dataStates')
    ? rpg('$dataStates')
        .filter((state): state is DataState => !!state && !!state.name)
        .map((state) => ({ id: state.id, name: state.name }))
    : []

  if (!targetOptions.value.some((option) => option.key === targetKey.value)) targetKey.value = 'party'
}

function describe(member: Battler, key: string, side: '아군' | '적'): MemberView {
  const names = paramNames()
  const buffs: Buff[] = []

  for (let paramId = 0; paramId < names.length; paramId += 1) {
    const level = member.buff?.(paramId) ?? 0
    if (level !== 0) buffs.push({ paramId, label: `${names[paramId]} ${level > 0 ? '+' : ''}${level}` })
  }

  return {
    key,
    side,
    member,
    name: member.name?.() ?? '',
    states: member.states().map((state) => ({ id: state.id, name: state.name })),
    buffs
  }
}

function apply(state: DataState): void {
  targets.value.forEach((target) => target.member.addState(state.id))
  refresh()
  toast.success(`"${state.name}" 을 ${targets.value.length}명에게 부여했다`)
}

function clearAll(kind: 'states' | 'buffs'): void {
  targets.value.forEach((target) =>
    kind === 'states' ? target.member.clearStates() : target.member.removeAllBuffs()
  )
  refresh()
  toast.success(`${targets.value.length}명의 ${kind === 'states' ? '상태' : '버프'}를 해제했다`)
}

function removeState(member: MemberView, id: number): void {
  member.member.removeState(id)
  refresh()
}

function removeBuff(member: MemberView, paramId: number): void {
  member.member.removeBuff(paramId)
  refresh()
}
</script>

<template>
  <div class="content">
    <div class="strip">
      <span class="chips__label">적용 대상</span>
      <div class="chips">
        <button
          v-for="option in targetOptions"
          :key="option.key"
          class="chip"
          :class="{ 'chip--active': option.key === targetKey }"
          @click="targetKey = option.key"
        >
          {{ option.label }}
        </button>
      </div>
      <span class="spacer" />
      <button class="btn btn--sm" :disabled="targets.length === 0" @click="clearAll('states')">상태 해제</button>
      <button class="btn btn--sm" :disabled="targets.length === 0" @click="clearAll('buffs')">버프 해제</button>
      <button class="btn btn--sm btn--icon" title="다시 읽기" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <div class="section">
        <div class="section__head">
          <span>현재 상태</span><span class="tab__count">{{ members.length }}</span>
        </div>
        <div class="section__body">
          <div v-if="members.length === 0" class="empty">전투 중이 아니거나 파티가 비어 있습니다.</div>
          <div v-else class="kv">
            <template v-for="member in members" :key="member.key">
              <span class="kv__k">
                <span class="pill" :class="member.side === '아군' ? 'pill--accent' : 'pill--danger'">
                  {{ member.side }}
                </span>
                {{ member.name }}
              </span>
              <span class="row-wrap">
                <span v-if="member.states.length === 0 && member.buffs.length === 0" class="faint">없음</span>
                <span v-for="state in member.states" :key="`s${state.id}`" class="pill pill--warn">
                  {{ state.name }}
                  <button class="pill__x" title="해제" @click="removeState(member, state.id)">
                    <AppIcon name="close" :size="10" />
                  </button>
                </span>
                <span v-for="buff in member.buffs" :key="`b${buff.paramId}`" class="pill pill--ok">
                  {{ buff.label }}
                  <button class="pill__x" title="해제" @click="removeBuff(member, buff.paramId)">
                    <AppIcon name="close" :size="10" />
                  </button>
                </span>
              </span>
            </template>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head">상태 부여</div>
        <div class="section__body">
          <SearchBox
            v-model="view.search"
            placeholder="상태 이름 · #12"
            :shown="shown.length"
            :total="states.length"
          />

          <DataTable
            v-model:sort="view.sort"
            v-model:page="view.page"
            v-model:per-page="view.perPage"
            v-model:widths="view.widths"
            style="margin-top: 8px"
            :columns="columns"
            :rows="shown"
            empty-text="조건에 맞는 상태가 없습니다."
          >
            <template #id="{ row }">
              <span class="cell-id">{{ row.id }}</span>
            </template>
            <template #actions="{ row }">
              <button class="btn btn--sm" :disabled="targets.length === 0" @click="apply(row)">부여</button>
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>
