<script setup>
import { computed } from 'vue';
import { theme, toggleTheme } from '../utils/theme.js';

const label = computed(() => (theme.value === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'));
</script>

<template>
  <button class="theme-toggle" type="button" :aria-label="label" :title="label" @click="toggleTheme">
    <span aria-hidden="true">{{ theme === 'dark' ? '☀️' : '🌙' }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-bg-elevated);
  font-size: 1.1rem;
  cursor: pointer;
  transition: border-color var(--transition), transform var(--transition);
}
.theme-toggle:hover {
  border-color: var(--color-strong);
  transform: rotate(-15deg);
}
</style>
