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
import { t } from '@/i18n'

type Side = 'party' | 'enemy'

interface Buff {
  paramId: number
  label: string
}

interface MemberView {
  key: string
  side: Side
  name: string
  states: DataState[]
  buffs: Buff[]
  member: Battler
}

const columns = computed<Column[]>(() => [
  { key: 'id', label: t('col.id'), width: 64, align: 'right' },
  { key: 'name', label: t('col.state') },
  { key: 'actions', label: '', width: 80, sortable: false }
])

const view = useSession().view('states', { perPage: 15, widths: { id: 64 } })
const members = ref<MemberView[]>([])
const states = ref<DataState[]>([])
const targetKey = ref('party')

const party = computed(() => members.value.filter((m) => m.side === 'party'))
const enemies = computed(() => members.value.filter((m) => m.side === 'enemy'))

const targetOptions = computed(() => [
  { key: 'party', label: t('states.partyAll', { count: party.value.length }) },
  { key: 'enemy', label: t('states.enemyAll', { count: enemies.value.length }) },
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
    ...partyMembers().map((member, index) => describe(member, `party-${index}`, 'party')),
    ...troopMembers().map((member, index) => describe(member, `enemy-${index}`, 'enemy'))
  ]

  states.value = has('$dataStates')
    ? rpg('$dataStates')
        .filter((state): state is DataState => !!state && !!state.name)
        .map((state) => ({ id: state.id, name: state.name }))
    : []

  if (!targetOptions.value.some((option) => option.key === targetKey.value)) targetKey.value = 'party'
}

function describe(member: Battler, key: string, side: Side): MemberView {
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
  toast.success(t('states.appliedToast', { name: state.name, count: targets.value.length }))
}

function clearAll(kind: 'states' | 'buffs'): void {
  targets.value.forEach((target) =>
    kind === 'states' ? target.member.clearStates() : target.member.removeAllBuffs()
  )
  refresh()
  toast.success(
    t(kind === 'states' ? 'states.clearedStatesToast' : 'states.clearedBuffsToast', {
      count: targets.value.length
    })
  )
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
      <span class="chips__label">{{ t('states.target') }}</span>
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
      <button class="btn btn--sm" :disabled="targets.length === 0" @click="clearAll('states')">{{ t('states.clearStates') }}</button>
      <button class="btn btn--sm" :disabled="targets.length === 0" @click="clearAll('buffs')">{{ t('states.clearBuffs') }}</button>
      <button class="btn btn--sm btn--icon" :title="t('common.refresh')" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <div class="section">
        <div class="section__head">
          <span>{{ t('states.current') }}</span><span class="tab__count">{{ members.length }}</span>
        </div>
        <div class="section__body">
          <div v-if="members.length === 0" class="empty">{{ t('states.noMembers') }}</div>
          <div v-else class="kv">
            <template v-for="member in members" :key="member.key">
              <span class="kv__k">
                <span class="pill" :class="member.side === 'party' ? 'pill--accent' : 'pill--danger'">
                  {{ t(member.side === 'party' ? 'common.party' : 'common.enemy') }}
                </span>
                {{ member.name }}
              </span>
              <span class="row-wrap">
                <span v-if="member.states.length === 0 && member.buffs.length === 0" class="faint">{{ t('common.none') }}</span>
                <span v-for="state in member.states" :key="`s${state.id}`" class="pill pill--warn">
                  {{ state.name }}
                  <button class="pill__x" :title="t('states.release')" @click="removeState(member, state.id)">
                    <AppIcon name="close" :size="10" />
                  </button>
                </span>
                <span v-for="buff in member.buffs" :key="`b${buff.paramId}`" class="pill pill--ok">
                  {{ buff.label }}
                  <button class="pill__x" :title="t('states.release')" @click="removeBuff(member, buff.paramId)">
                    <AppIcon name="close" :size="10" />
                  </button>
                </span>
              </span>
            </template>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head">{{ t('states.assign') }}</div>
        <div class="section__body">
          <SearchBox
            v-model="view.search"
            :placeholder="t('states.searchPlaceholder')"
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
            :empty-text="t('states.empty')"
          >
            <template #id="{ row }">
              <span class="cell-id">{{ row.id }}</span>
            </template>
            <template #actions="{ row }">
              <button class="btn btn--sm" :disabled="targets.length === 0" @click="apply(row)">{{ t('states.apply') }}</button>
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>
