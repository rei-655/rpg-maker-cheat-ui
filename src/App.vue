<script setup lang="ts">
import AppWindow from '@/app/AppWindow.vue'
import ToastHost from '@/shared/ui/ToastHost.vue'
import ConfirmHost from '@/shared/ui/ConfirmHost.vue'
import { useHotkeys } from '@/app/useHotkeys'
import { ui } from '@/app/actions'
import { useSession } from '@/stores/session'

const session = useSession()

ui.toggleWindow = (panelId?: string) => session.toggle(panelId)
ui.openWindow = (panelId: string) => session.show(panelId)

useHotkeys()
</script>

<template>
  <AppWindow v-if="session.open" />
  <ToastHost />
  <ConfirmHost />
</template>
