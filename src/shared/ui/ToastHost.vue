<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import { useToasts, type ToastLevel } from '@/shared/composables/useToast'

const { toasts, dismiss } = useToasts()

const icon = (level: ToastLevel) =>
  level === 'success' ? 'check' : level === 'info' ? 'target' : 'warning'
</script>

<template>
  <div v-if="toasts.length > 0" class="toasts">
    <div v-for="item in toasts" :key="item.id" class="toast" :class="`toast--${item.level}`">
      <AppIcon :name="icon(item.level)" :size="14" />
      <span class="toast__text">{{ item.text }}</span>
      <button class="btn btn--sm btn--icon btn--ghost" title="닫기" @click="dismiss(item.id)">
        <AppIcon name="close" :size="12" />
      </button>
    </div>
  </div>
</template>
