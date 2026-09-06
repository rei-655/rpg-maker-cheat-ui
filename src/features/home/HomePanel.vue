<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import AppIcon from '@/shared/ui/AppIcon.vue'
import ValueInput from '@/shared/ui/ValueInput.vue'
import { homeCards } from '@/app/panels'
import { MAX_GOLD, battle, encounters, godMode, movement, scenes, wallet } from '@/engine/cheats'
import { partyMembers } from '@/engine/globals'
import { toInt } from '@/shared/lib/coerce'
import { toast } from '@/shared/composables/useToast'
import { useSession } from '@/stores/session'
import { t } from '@/i18n'

const session = useSession()
const cards = homeCards()

const state = reactive({ gold: 0, noClip: false, noEncounter: false, god: 0, party: 0 })

onMounted(refresh)

function refresh(): void {
  const members = partyMembers()

  state.gold = wallet.gold()
  state.noClip = movement.noClip()
  state.noEncounter = encounters.disabled()
  state.party = members.length
  state.god = members.filter((actor) => godMode.isOn(actor)).length
}

function setGold(raw: string | number): void {
  const value = toInt(raw)
  if (value === null) return

  wallet.setGold(value)
  refresh()
  toast.success(t('home.goldSet', { amount: state.gold.toLocaleString() }))
}

function fillGold(): void {
  wallet.setGold(MAX_GOLD)
  refresh()
  toast.success(t('home.goldFilled'))
}

function healParty(): void {
  battle.recoverAll(partyMembers())
  toast.success(t('home.healed'))
}

const FILL_LABEL = { hp: 'home.fillHp', mp: 'home.fillMp', tp: 'home.fillTp' } as const

function fill(field: 'hp' | 'mp' | 'tp'): void {
  battle.fillAll(partyMembers(), field)
  toast.success(t(FILL_LABEL[field]))
}

function toggleGodAll(): void {
  const members = partyMembers()
  const turnOn = state.god < members.length

  for (const actor of members) {
    if (godMode.isOn(actor) !== turnOn) godMode.toggle(actor)
  }

  refresh()
  toast.success(turnOn ? t('home.godOn', { count: members.length }) : t('home.godOff'))
}

function toggleNoClip(): void {
  movement.toggleNoClip()
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
      <span class="hint">{{ t('home.lead') }}</span>
      <span class="spacer" />
      <button class="btn btn--sm btn--icon" :title="t('common.refresh')" @click="refresh">
        <AppIcon name="refresh" :size="13" />
      </button>
    </div>

    <div class="content__scroll">
      <div class="section">
        <div class="section__head">
          <span>{{ t('home.money') }}</span>
          <span class="spacer" />
          <span class="hint">{{ t('home.setGold') }}</span>
        </div>
        <div class="section__body row-wrap">
          <ValueInput
            :value="state.gold"
            :width="180"
            :title="t('common.commitHint')"
            @commit="setGold"
          />
          <button class="btn" @click="fillGold">{{ t('common.max') }}</button>
        </div>
      </div>

      <div class="section">
        <div class="section__head">{{ t('home.survive') }}</div>
        <div class="section__body row-wrap">
          <button class="big" :disabled="state.party === 0" @click="healParty">
            <AppIcon name="status" :size="18" />
            <span>{{ t('home.healParty') }}</span>
          </button>
          <button class="big" :disabled="state.party === 0" @click="fill('hp')">
            <span>{{ t('home.fillHp') }}</span>
          </button>
          <button class="big" :disabled="state.party === 0" @click="fill('mp')">
            <span>{{ t('home.fillMp') }}</span>
          </button>
          <button class="big" :disabled="state.party === 0" @click="fill('tp')">
            <span>{{ t('home.fillTp') }}</span>
          </button>
          <button
            class="big"
            :class="{ 'big--on': state.party > 0 && state.god === state.party }"
            :disabled="state.party === 0"
            @click="toggleGodAll"
          >
            <AppIcon name="battle" :size="18" />
            <span>{{ state.party > 0 && state.god === state.party ? t('home.godAllOff') : t('home.godAll') }}</span>
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section__head">{{ t('home.explore') }}</div>
        <div class="section__body row-wrap">
          <button class="big" :class="{ 'big--on': state.noClip }" @click="toggleNoClip">
            <AppIcon name="locations" :size="18" />
            <span>{{ t('home.noClip') }}</span>
            <span class="big__state">{{ t(state.noClip ? 'common.on' : 'common.off') }}</span>
          </button>
          <button class="big" :class="{ 'big--on': state.noEncounter }" @click="toggleEncounters">
            <AppIcon name="states" :size="18" />
            <span>{{ t('home.noEncounter') }}</span>
            <span class="big__state">{{ t(state.noEncounter ? 'common.on' : 'common.off') }}</span>
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section__head">{{ t('home.screens') }}</div>
        <div class="section__body">
          <div class="btn-group">
            <button class="btn" @click="scenes.toggleSave()"><AppIcon name="save" :size="13" />{{ t('home.save') }}</button>
            <button class="btn" @click="scenes.toggleLoad()"><AppIcon name="load" :size="13" />{{ t('home.load') }}</button>
            <button class="btn" @click="scenes.toTitle()"><AppIcon name="home" :size="13" />{{ t('home.title') }}</button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head">{{ t('home.links') }}</div>
        <div class="section__body">
          <div class="hub">
            <button v-for="card in cards" :key="card.id" class="hub__card" @click="session.panelId = card.id">
              <AppIcon :name="card.icon" :size="17" />
              <span>
                <span class="hub__name">{{ t(card.labelKey) }}</span>
                <span class="hub__desc">{{ t(card.hintKey) }}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
