<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import SearchBox from '@/shared/ui/SearchBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { battle, godMode } from '@/engine/cheats'
import { has, paramNames, partyMembers, rpg } from '@/engine/globals'
import type { Actor, DataState } from '@/engine/types'
import { clamp, toInt } from '@/shared/lib/coerce'
import { matches, parseQuery } from '@/shared/lib/query'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { t } from '@/i18n'

interface Buff {
  paramId: number
  label: string
}

interface MemberRow {
  key: string
  id: number
  name: string
  hp: number
  mhp: number
  mp: number
  mmp: number
  tp: number
  mtp: number
  level: number
  maxLevel: number
  exp: number
  god: boolean
  params: number[]
  states: DataState[]
  buffs: Buff[]
  actor: Actor
}

const columns = computed<Column[]>(() => [
  { key: 'name', label: t('col.name'), width: 150 },
  { key: 'hp', label: 'HP', width: 165, align: 'right' },
  { key: 'mp', label: 'MP', width: 165, align: 'right' },
  { key: 'tp', label: 'TP', width: 165, align: 'right' },
  { key: 'level', label: t('party.level'), width: 90, align: 'right' },
  { key: 'god', label: t('party.god'), width: 90, sortable: false }
])

const stateColumns = computed<Column[]>(() => [
  { key: 'id', label: t('col.id'), width: 64, align: 'right' },
  { key: 'name', label: t('col.name') },
  { key: 'actions', label: '', width: 80, sortable: false }
])

const session = useSession()
const view = session.view('party', { sort: { key: 'name', desc: false }, widths: { name: 150 } })
const stateView = session.view('party.states', { widths: { id: 64 } })

const rows = ref<MemberRow[]>([])
const selectedKey = ref<string | null>(null)
const allStates = ref<DataState[]>([])
const names = ref<string[]>([])

const selected = computed(() => rows.value.find((row) => row.key === selectedKey.value) ?? null)

const params = computed(() =>
  (selected.value?.params ?? []).map((value, paramId) => ({
    paramId,
    name: names.value[paramId] ?? `#${paramId}`,
    value
  }))
)

const shownStates = computed(() => {
  const query = parseQuery(stateView.search)
  return allStates.value.filter((state) => matches(query, { id: state.id, value: state.id, texts: [state.name] }))
})

onMounted(refresh)

function refresh(): void {
  names.value = paramNames()
  rows.value = partyMembers().map((actor, index) => describe(actor, index))

  allStates.value = has('$dataStates')
    ? rpg('$dataStates')
        .filter((state): state is DataState => !!state && !!state.name)
        .map((state) => ({ id: state.id, name: state.name }))
    : []

  if (!rows.value.some((row) => row.key === selectedKey.value)) {
    selectedKey.value = rows.value[0]?.key ?? null
  }
}

function describe(actor: Actor, index: number): MemberRow {
  const count = actor._paramPlus?.length ?? 0
  const buffs: Buff[] = []

  for (let paramId = 0; paramId < names.value.length; paramId += 1) {
    const level = actor.buff?.(paramId) ?? 0
    if (level !== 0) buffs.push({ paramId, label: `${names.value[paramId]} ${level > 0 ? '+' : ''}${level}` })
  }

  return {
    actor,
    // 同じアクターが二度並ぶゲームもある。行が消えないよう位置で一意にする。
    key: `${index}-${actor._actorId}`,
    id: actor._actorId,
    name: actor.name?.() ?? '',
    hp: actor.hp,
    mhp: actor.mhp,
    mp: actor.mp,
    mmp: actor.mmp,
    tp: actor.tp,
    mtp: actor.maxTp?.() ?? 100,
    level: actor.level,
    maxLevel: actor.maxLevel(),
    exp: actor.currentExp(),
    god: godMode.isOn(actor),
    params: Array.from({ length: count }, (_, paramId) => actor.param(paramId)),
    states: actor.states().map((state) => ({ id: state.id, name: state.name })),
    buffs
  }
}

function setPool(row: MemberRow, field: 'hp' | 'mp' | 'tp', raw: string | number): void {
  const value = toInt(raw)

  if (value !== null) {
    const max = { hp: row.mhp, mp: row.mmp, tp: row.mtp }[field]
    const setter = { hp: row.actor.setHp, mp: row.actor.setMp, tp: row.actor.setTp }[field]
    setter.call(row.actor, clamp(value, 0, max))
  }

  refresh()
}

function setLevel(raw: string | number): void {
  const level = toInt(raw)
  const row = selected.value

  // 最大レベルを超えると changeLevel が例外を投げる
  if (level !== null && row) row.actor.changeLevel(clamp(level, 1, row.maxLevel), false)
  refresh()
}

function setExp(raw: string | number): void {
  const exp = toInt(raw)
  if (exp !== null && selected.value) selected.value.actor.changeExp(Math.max(exp, 0), false)
  refresh()
}

function setParam(paramId: number, raw: string): void {
  const value = toInt(raw)
  const actor = selected.value?.actor

  // addParam は相対値なので差分を渡す
  if (value !== null && actor) actor.addParam(paramId, value - actor.param(paramId))
  refresh()
}

function heal(row: MemberRow): void {
  battle.recover(row.actor)
  refresh()
}

function healAll(): void {
  battle.recoverAll(partyMembers())
  refresh()
  toast.success(t('action.partyRecover'))
}

function toggleGod(row: MemberRow): void {
  godMode.toggle(row.actor)
  refresh()
}

function addState(state: DataState): void {
  selected.value?.actor.addState(state.id)
  refresh()
}

function removeState(id: number): void {
  selected.value?.actor.removeState(id)
  refresh()
}

function removeBuff(paramId: number): void {
  selected.value?.actor.removeBuff(paramId)
  refresh()
}

function clearAll(): void {
  selected.value?.actor.clearStates()
  selected.value?.actor.removeAllBuffs()
  refresh()
}
</script>

<template>
  <div class="content">
    <div class="strip">
      <span class="hint">{{ t('party.lead') }}</span>
      <span class="spacer" />
      <button class="btn btn--sm btn--primary" :disabled="rows.length === 0" @click="healAll">
        {{ t('party.healAll') }}
      </button>
      <button class="btn btn--sm btn--icon" :title="t('common.refresh')" @click="refresh">
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
        :rows="rows"
        row-key="key"
        clickable
        :selected-key="selectedKey"
        :empty-text="t('party.empty')"
        @row-click="selectedKey = $event.key"
      >
        <template #hp="{ row }">
          <div class="row">
            <ValueInput :value="row.hp" :width="70" @commit="setPool(row, 'hp', $event)" />
            <span class="mono faint nowrap">/ {{ row.mhp }}</span>
          </div>
        </template>
        <template #mp="{ row }">
          <div class="row">
            <ValueInput :value="row.mp" :width="70" @commit="setPool(row, 'mp', $event)" />
            <span class="mono faint nowrap">/ {{ row.mmp }}</span>
          </div>
        </template>
        <template #tp="{ row }">
          <div class="row">
            <ValueInput :value="row.tp" :width="70" @commit="setPool(row, 'tp', $event)" />
            <span class="mono faint nowrap">/ {{ row.mtp }}</span>
          </div>
        </template>
        <template #god="{ row }">
          <button class="btn btn--sm" :class="{ 'btn--primary': row.god }" @click.stop="toggleGod(row)">
            <span class="dot" :class="row.god ? 'dot-ok' : 'dot-muted'" />
            {{ t(row.god ? 'common.on' : 'common.off') }}
          </button>
        </template>
      </DataTable>

      <div v-if="selected" class="detail">
        <div class="detail__head">
          <span>{{ selected.name }}</span>
          <span class="spacer" />
          <button class="btn btn--sm" @click="heal(selected)">{{ t('party.heal') }}</button>
        </div>

        <div class="detail__body">
          <div class="row-wrap">
            <div class="field">
              <span class="field__label">{{ t('party.levelRange', { max: selected.maxLevel }) }}</span>
              <div class="row">
                <ValueInput :value="selected.level" :width="90" @commit="setLevel" />
                <button class="btn btn--sm" @click="setLevel(selected.maxLevel)">{{ t('party.levelMax') }}</button>
              </div>
            </div>
            <div class="field">
              <span class="field__label">{{ t('party.exp') }}</span>
              <ValueInput :value="selected.exp" :width="150" @commit="setExp" />
            </div>
          </div>

          <div class="section" style="margin-top: 12px">
            <div class="section__head">{{ t('party.params') }}</div>
            <div class="section__body">
              <div class="params">
                <div v-for="param in params" :key="param.paramId" class="field">
                  <span class="field__label">{{ param.name }}</span>
                  <ValueInput :value="param.value" :width="96" @commit="setParam(param.paramId, $event)" />
                </div>
              </div>
              <div v-if="params.length === 0" class="empty">{{ t('party.emptyParams') }}</div>
            </div>
          </div>

          <div class="section">
            <div class="section__head">
              <span>{{ t('party.states') }}</span>
              <span class="spacer" />
              <button
                class="btn btn--sm"
                :disabled="selected.states.length === 0 && selected.buffs.length === 0"
                @click="clearAll"
              >
                {{ t('party.clearStates') }}
              </button>
            </div>
            <div class="section__body">
              <div class="row-wrap">
                <span v-if="selected.states.length === 0 && selected.buffs.length === 0" class="faint">
                  {{ t('party.noStates') }}
                </span>
                <span v-for="state in selected.states" :key="`s${state.id}`" class="pill pill--warn">
                  {{ state.name }}
                  <button class="pill__x" :title="t('party.release')" @click="removeState(state.id)">
                    <AppIcon name="close" :size="10" />
                  </button>
                </span>
                <span v-for="buff in selected.buffs" :key="`b${buff.paramId}`" class="pill pill--ok">
                  {{ buff.label }}
                  <button class="pill__x" :title="t('party.release')" @click="removeBuff(buff.paramId)">
                    <AppIcon name="close" :size="10" />
                  </button>
                </span>
              </div>

              <details class="more">
                <summary>{{ t('party.addState') }}</summary>
                <SearchBox
                  v-model="stateView.search"
                  :placeholder="t('party.stateSearch')"
                  :shown="shownStates.length"
                  :total="allStates.length"
                />
                <DataTable
                  v-model:sort="stateView.sort"
                  v-model:page="stateView.page"
                  v-model:per-page="stateView.perPage"
                  v-model:widths="stateView.widths"
                  style="margin-top: 8px"
                  :columns="stateColumns"
                  :rows="shownStates"
                  :empty-text="t('party.noStateMatch')"
                >
                  <template #id="{ row }">
                    <span class="cell-id">{{ row.id }}</span>
                  </template>
                  <template #actions="{ row }">
                    <button class="btn btn--sm" @click="addState(row)">{{ t('party.apply') }}</button>
                  </template>
                </DataTable>
              </details>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="rows.length > 0" class="hint" style="margin-top: 10px">{{ t('party.selectHint') }}</div>
    </div>
  </div>
</template>
