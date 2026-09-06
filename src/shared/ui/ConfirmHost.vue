<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useConfirm } from '@/shared/composables/useConfirm'
import { t } from '@/i18n'

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
      <div class="dialog__head">{{ request.title ?? t('common.confirm') }}</div>
      <div class="dialog__body">{{ request.message }}</div>
      <div class="dialog__foot">
        <button class="btn" @click="answer(false)">{{ t('common.cancel') }}</button>
        <button
          class="btn"
          :class="request.danger ? 'btn--danger' : 'btn--primary'"
          @click="answer(true)"
        >
          {{ request.confirmText ?? t('common.confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>
