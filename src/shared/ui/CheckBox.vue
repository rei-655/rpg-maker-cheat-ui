<script setup lang="ts">
import AppIcon from './AppIcon.vue'

const { label = '', title = '' } = defineProps<{ label?: string; title?: string }>()
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="check" :class="{ 'check--on': model }" :title="title">
    <span class="check__box"><AppIcon name="check" :size="11" /></span>
    <input v-model="model" type="checkbox" hidden />
    <span v-if="label">{{ label }}</span>
  </label>
</template>
