<script setup lang="ts">
import VariablesTable from './VariablesTable.vue'
import SwitchesTable from './SwitchesTable.vue'
import { useSession } from '@/stores/session'
import { t } from '@/i18n'

const TABS = ['variables', 'switches'] as const

const view = useSession().view('data', { tab: 'variables' })
</script>

<template>
  <div class="content">
    <div class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab"
        class="tab"
        :class="{ 'tab--active': tab === view.tab }"
        @click="view.tab = tab"
      >
        {{ t(`data.${tab}`) }}
      </button>
      <span class="spacer" />
      <span class="hint">{{ t('data.lead') }}</span>
    </div>

    <div class="content__scroll">
      <VariablesTable v-if="view.tab !== 'switches'" />
      <SwitchesTable v-else />
    </div>
  </div>
</template>
