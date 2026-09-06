<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const {
  value,
  width = 0,
  text = false,
  placeholder = '',
  title = ''
} = defineProps<{
  value: string | number
  width?: number
  text?: boolean
  placeholder?: string
  title?: string
}>()

const emit = defineEmits<{ commit: [string]; editStart: [] }>()

const input = ref<HTMLInputElement | null>(null)
const draft = ref('')
const editing = ref(false)
const flashing = ref(false)

const shown = computed(() => (value === null || value === undefined ? '' : String(value)))

let flashTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => value,
  () => {
    if (!editing.value) draft.value = shown.value
  },
  { immediate: true }
)

function onFocus(): void {
  editing.value = true
  emit('editStart')
}

/** Enter・Tab・フォーカス喪失で確定、Esc で元に戻す。 */
function commit(keepFocus: boolean): void {
  editing.value = false

  if (draft.value === shown.value) {
    draft.value = shown.value
    return
  }

  emit('commit', draft.value)
  flash()

  if (keepFocus) input.value?.select()
}

function cancel(): void {
  editing.value = false
  draft.value = shown.value
  input.value?.blur()
}

function onKeydown(event: KeyboardEvent): void {
  event.stopPropagation()

  if (event.key === 'Enter') {
    event.preventDefault()
    commit(true)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
  } else if (event.key === 'Tab') {
    commit(false)
  }
}

function flash(): void {
  flashing.value = true
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flashing.value = false), 420)
}
</script>

<template>
  <input
    ref="input"
    class="input"
    :class="[text ? 'input--text' : 'input--num', { 'input--flash': flashing }]"
    :style="width > 0 ? { width: `${width}px` } : { width: '100%' }"
    :value="draft"
    :placeholder="placeholder"
    :title="title"
    @input="draft = ($event.target as HTMLInputElement).value"
    @focus="onFocus"
    @blur="commit(false)"
    @keydown="onKeydown"
  />
</template>
