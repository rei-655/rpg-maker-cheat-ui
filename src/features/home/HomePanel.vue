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
import { t } from '@/i18n'

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
        <div class="stat__label">{{ t('home.gold') }}</div>
        <div class="stat__value">{{ snapshot.gold.toLocaleString() }}</div>
      </div>
      <div class="stat">
        <div class="stat__label">{{ t('home.party') }}</div>
        <div class="stat__value">{{ snapshot.party }}</div>
      </div>
      <div class="stat">
        <div class="stat__label">{{ t('home.map') }}</div>
        <div class="stat__value">{{ snapshot.mapId }}</div>
      </div>
      <div class="stat">
        <div class="stat__label">{{ t('home.pos') }}</div>
        <div class="stat__value">{{ snapshot.x }}, {{ snapshot.y }}</div>
      </div>
      <span class="spacer" />
      <span class="status">
        <span class="dot" :class="snapshot.noClip ? 'dot-warn' : 'dot-muted'" />
        {{ t('home.noClip') }} {{ t(snapshot.noClip ? 'common.on' : 'common.off') }}
      </span>
      <button class="btn btn--sm btn--icon" :title="t('common.refresh')" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <div class="section">
        <div class="section__head">{{ t('home.quickActions') }}</div>
        <div class="section__body row-wrap">
          <div class="field">
            <span class="field__label">{{ t('home.gold') }}</span>
            <div class="row">
              <ValueInput :value="snapshot.gold" :width="140" :title="t('common.commitHint')" @commit="setGold" />
              <button class="btn" :title="t('common.max')" @click="setGold(MAX_GOLD)">Max</button>
            </div>
          </div>

          <div class="field">
            <span class="field__label">{{ t('home.movement') }}</span>
            <CheckBox v-model="snapshot.noClip" :label="t('home.noClip')" @update:model-value="toggleNoClip" />
          </div>

          <div class="field grow">
            <span class="field__label">{{ t('home.screen') }}</span>
            <div class="btn-group">
              <button class="btn" @click="scenes.toggleSave()"><AppIcon name="save" :size="13" />{{ t('home.save') }}</button>
              <button class="btn" @click="scenes.toggleLoad()"><AppIcon name="load" :size="13" />{{ t('home.load') }}</button>
              <button class="btn" @click="scenes.toTitle()"><AppIcon name="home" :size="13" />{{ t('home.title') }}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head">{{ t('home.links') }}</div>
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
                <span class="hub__desc">{{ t(card.hintKey) }}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
