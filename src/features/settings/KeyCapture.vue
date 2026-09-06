<script setup lang="ts">
import { ref } from 'vue'
import { comboFrom, formatCombo, isModifierKey } from '@/app/keys'

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
    :title="'클릭 후 원하는 키 조합 · Backspace 로 해제'"
    @focus="capturing = true"
    @blur="capturing = false"
    @keydown="onKeydown"
  >
    {{ capturing ? '키 입력...' : formatCombo(combo) }}
  </button>
</template>
