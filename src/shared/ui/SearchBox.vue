<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { t } from '@/i18n'

const {
  placeholder = '',
  shown = -1,
  total = -1,
  autofocus = false
} = defineProps<{
  placeholder?: string
  shown?: number
  total?: number
  autofocus?: boolean
}>()

const model = defineModel<string>({ required: true })
const input = ref<HTMLInputElement | null>(null)

const count = computed(() => {
  if (shown < 0 || total < 0) return ''
  return shown === total ? String(total) : `${shown} / ${total}`
})

onMounted(() => {
  if (autofocus) input.value?.focus()
})

function onKeydown(event: KeyboardEvent): void {
  event.stopPropagation()

  if (event.key === 'Escape') {
    event.preventDefault()
    clear()
  }
}

function clear(): void {
  model.value = ''
  input.value?.focus()
}
</script>

<template>
  <div class="search">
    <AppIcon name="search" :size="14" />
    <input ref="input" v-model="model" type="text" :placeholder="placeholder || t('common.search')" @keydown="onKeydown" />
    <span v-if="count" class="search__count">{{ count }}</span>
    <button v-if="model" class="btn btn--sm btn--icon btn--ghost" :title="t('common.clearInput')" @click="clear">
      <AppIcon name="close" :size="13" />
    </button>
  </div>
</template>
