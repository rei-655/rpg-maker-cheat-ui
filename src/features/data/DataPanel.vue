<script setup lang="ts">
import VariablesTable from './VariablesTable.vue'
import SwitchesTable from './SwitchesTable.vue'
import FinderTable from './FinderTable.vue'
import { useSession } from '@/stores/session'
import { t } from '@/i18n'

const TABS = ['variables', 'switches', 'finder'] as const

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
      <span class="hint">{{ t(view.tab === 'finder' ? 'finder.lead' : 'data.lead') }}</span>
    </div>

    <div class="content__scroll">
      <SwitchesTable v-if="view.tab === 'switches'" />
      <FinderTable v-else-if="view.tab === 'finder'" />
      <VariablesTable v-else />
    </div>
  </div>
</template>
