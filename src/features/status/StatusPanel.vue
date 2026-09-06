<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import DataTable, { type Column } from '@/shared/ui/DataTable.vue'
import { godMode } from '@/engine/cheats'
import { paramNames, partyMembers } from '@/engine/globals'
import type { Actor } from '@/engine/types'
import { clamp, toInt } from '@/shared/lib/coerce'
import { useSession } from '@/stores/session'

interface ActorView {
  id: number
  name: string
  level: number
  maxLevel: number
  exp: number
  godMode: boolean
  params: number[]
  actor: Actor
}

const columns: Column[] = [
  { key: 'paramId', label: '#', width: 64, align: 'right' },
  { key: 'name', label: '능력치', width: 220 },
  { key: 'value', label: '값', align: 'right' }
]

const view = useSession().view('status', {
  sort: { key: 'paramId', desc: false },
  perPage: 0,
  widths: { paramId: 64, name: 220 }
})

const actors = ref<ActorView[]>([])
const selectedId = ref<number | null>(null)
const names = ref<string[]>([])

const selected = computed(() => actors.value.find((a) => a.id === selectedId.value) ?? actors.value[0] ?? null)

const params = computed(() =>
  (selected.value?.params ?? []).map((value, paramId) => ({
    paramId,
    name: names.value[paramId] ?? `param ${paramId}`,
    value
  }))
)

onMounted(refresh)

function refresh(): void {
  names.value = paramNames()
  actors.value = partyMembers().map(describe)

  if (!actors.value.some((actor) => actor.id === selectedId.value)) {
    selectedId.value = actors.value[0]?.id ?? null
  }
}

function describe(actor: Actor): ActorView {
  const count = actor._paramPlus?.length ?? 0

  return {
    actor,
    id: actor._actorId,
    name: actor.name?.() ?? '',
    level: actor.level,
    maxLevel: actor.maxLevel(),
    exp: actor.currentExp(),
    godMode: godMode.isOn(actor),
    params: Array.from({ length: count }, (_, paramId) => actor.param(paramId))
  }
}

function setLevel(raw: string | number): void {
  const level = toInt(raw)
  const target = selected.value

  // 最大レベルを超えると changeLevel が例外を投げる
  if (level !== null && target) target.actor.changeLevel(clamp(level, 1, target.maxLevel), false)
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

function toggleGodMode(): void {
  if (selected.value) godMode.toggle(selected.value.actor)
  refresh()
}
</script>

<template>
  <div class="content">
    <div class="tabs">
      <button
        v-for="actor in actors"
        :key="actor.id"
        class="tab"
        :class="{ 'tab--active': actor.id === selected?.id }"
        @click="selectedId = actor.id"
      >
        {{ actor.name || `Actor ${actor.id}` }}
      </button>
    </div>

    <template v-if="selected">
      <div class="strip">
        <div class="stat">
          <div class="stat__label">Level</div>
          <div class="stat__value">{{ selected.level }}</div>
        </div>
        <div class="stat">
          <div class="stat__label">Exp</div>
          <div class="stat__value">{{ selected.exp.toLocaleString() }}</div>
        </div>
        <span class="spacer" />
        <span class="status">
          <span class="dot" :class="selected.godMode ? 'dot-ok' : 'dot-muted'" />
          무적 {{ selected.godMode ? 'ON' : 'OFF' }}
        </span>
        <button class="btn btn--sm" :class="selected.godMode ? 'btn--danger' : 'btn--primary'" @click="toggleGodMode">
          {{ selected.godMode ? '해제' : '무적' }}
        </button>
        <button class="btn btn--sm btn--icon" title="다시 읽기" @click="refresh">
          <AppIcon name="refresh" :size="13" />
        </button>
      </div>

      <div class="content__scroll">
        <div class="section">
          <div class="section__head">레벨 · 경험치</div>
          <div class="section__body row-wrap">
            <div class="field">
              <span class="field__label">Level (1 - {{ selected.maxLevel }})</span>
              <ValueInput :value="selected.level" :width="120" @commit="setLevel" />
            </div>
            <div class="field">
              <span class="field__label">Exp</span>
              <ValueInput :value="selected.exp" :width="160" @commit="setExp" />
            </div>
            <div class="field">
              <span class="field__label">한 번에</span>
              <div class="btn-group">
                <button class="btn" @click="setLevel(selected.level + 1)">Lv +1</button>
                <button class="btn" @click="setLevel(selected.maxLevel)">Lv Max</button>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section__head">능력치</div>
          <div class="section__body">
            <DataTable
              v-model:sort="view.sort"
              v-model:page="view.page"
              v-model:per-page="view.perPage"
              v-model:widths="view.widths"
              :columns="columns"
              :rows="params"
              row-key="paramId"
              empty-text="능력치를 읽지 못했습니다."
            >
              <template #value="{ row }">
                <ValueInput :value="row.value" :width="110" @commit="setParam(row.paramId, $event)" />
              </template>
            </DataTable>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="content__scroll">
      <div class="empty">파티에 멤버가 없습니다.</div>
    </div>
  </div>
</template>
