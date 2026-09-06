<script setup lang="ts">
import { ref } from 'vue'
import { comboFrom, formatCombo, isModifierKey } from '@/app/keys'
import { t } from '@/i18n'

const { combo } = defineProps<{ combo: string }>()
const emit = defineEmits<{ change: [string] }>()

const capturing = ref(false)

function onKeydown(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()

  if (event.key === 'Escape') {
    ;(event.target as HTMLElement).blur()
    return
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    emit('change', '')
    return
  }

  if (isModifierKey(event.code)) return

  emit('change', comboFrom(event))
  ;(event.target as HTMLElement).blur()
}
</script>

<template>
  <button
    class="keycap"
    :class="{ 'keycap--empty': !combo, 'keycap--capturing': capturing }"
    :title="t('keys.captureHint')"
    @focus="capturing = true"
    @blur="capturing = false"
    @keydown="onKeydown"
  >
    {{ capturing ? t('keys.capturing') : formatCombo(combo) }}
  </button>
</template>
