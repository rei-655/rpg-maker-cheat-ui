<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import CheckBox from '@/shared/ui/CheckBox.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import { homeCards } from '@/app/panels'
import { MAX_GOLD, movement, scenes, wallet } from '@/engine/cheats'
import { currentMapId, has, partyMembers, player } from '@/engine/globals'
import { toInt } from '@/shared/lib/coerce'
import { useSession } from '@/stores/session'

const session = useSession()
const cards = homeCards()

const snapshot = reactive({ gold: 0, party: 0, mapId: 0, x: 0, y: 0, noClip: false })

onMounted(refresh)

function refresh(): void {
  snapshot.gold = wallet.gold()
  snapshot.party = partyMembers().length
  snapshot.mapId = currentMapId()
  snapshot.x = has('$gamePlayer') ? player().x : 0
  snapshot.y = has('$gamePlayer') ? player().y : 0
  snapshot.noClip = movement.noClip()
}

function setGold(raw: string | number): void {
  const value = toInt(raw)
  if (value !== null) wallet.setGold(value)
  refresh()
}

function toggleNoClip(): void {
  movement.toggleNoClip()
  refresh()
}
</script>

<template>
  <div class="content">
    <div class="strip">
      <div class="stat">
        <div class="stat__label">Gold</div>
        <div class="stat__value">{{ snapshot.gold.toLocaleString() }}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Party</div>
        <div class="stat__value">{{ snapshot.party }}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Map</div>
        <div class="stat__value">{{ snapshot.mapId }}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Pos</div>
        <div class="stat__value">{{ snapshot.x }}, {{ snapshot.y }}</div>
      </div>
      <span class="spacer" />
      <span class="status">
        <span class="dot" :class="snapshot.noClip ? 'dot-warn' : 'dot-muted'" />
        벽 통과 {{ snapshot.noClip ? 'ON' : 'OFF' }}
      </span>
      <button class="btn btn--sm btn--icon" title="다시 읽기" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <div class="section">
        <div class="section__head">빠른 조작</div>
        <div class="section__body row-wrap">
          <div class="field">
            <span class="field__label">Gold</span>
            <div class="row">
              <ValueInput :value="snapshot.gold" :width="140" title="Enter 로 반영" @commit="setGold" />
              <button class="btn" title="최대치" @click="setGold(MAX_GOLD)">Max</button>
            </div>
          </div>

          <div class="field">
            <span class="field__label">이동</span>
            <CheckBox v-model="snapshot.noClip" label="벽 통과" @update:model-value="toggleNoClip" />
          </div>

          <div class="field grow">
            <span class="field__label">화면</span>
            <div class="btn-group">
              <button class="btn" @click="scenes.toggleSave()"><AppIcon name="save" :size="13" />저장</button>
              <button class="btn" @click="scenes.toggleLoad()"><AppIcon name="load" :size="13" />불러오기</button>
              <button class="btn" @click="scenes.toTitle()"><AppIcon name="home" :size="13" />타이틀</button>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head">바로가기</div>
        <div class="section__body">
          <div class="hub">
            <button
              v-for="card in cards"
              :key="card.id"
              class="hub__card"
              @click="session.panelId = card.id"
            >
              <AppIcon :name="card.icon" :size="17" />
              <span>
                <span class="hub__name">{{ card.label }}</span>
                <span class="hub__desc">{{ card.hint }}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
