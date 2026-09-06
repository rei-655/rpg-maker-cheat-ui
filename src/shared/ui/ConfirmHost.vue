<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useConfirm } from '@/shared/composables/useConfirm'

const { request, answer } = useConfirm()
const dialog = ref<HTMLElement | null>(null)

watch(request, async (value) => {
  if (!value) return
  await nextTick()
  dialog.value?.focus()
})

function onKeydown(event: KeyboardEvent): void {
  event.stopPropagation()

  if (event.key === 'Enter') {
    event.preventDefault()
    answer(true)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    answer(false)
  }
}
</script>

<template>
  <div v-if="request" class="overlay" @mousedown.self="answer(false)">
    <div ref="dialog" class="dialog" tabindex="-1" @keydown="onKeydown">
      <div class="dialog__head">{{ request.title ?? '확인' }}</div>
      <div class="dialog__body">{{ request.message }}</div>
      <div class="dialog__foot">
        <button class="btn" @click="answer(false)">취소</button>
        <button
          class="btn"
          :class="request.danger ? 'btn--danger' : 'btn--primary'"
          @click="answer(true)"
        >
          {{ request.confirmText ?? '확인' }}
        </button>
      </div>
    </div>
  </div>
</template>
