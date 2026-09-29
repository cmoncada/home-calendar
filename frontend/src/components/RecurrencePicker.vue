<script setup>
import { WEEKDAY_NAMES, WEEKDAYS_SHORT, WEEK_ORDER } from '../utils/dates.js';

const type = defineModel('type', { type: String, default: 'none' });
const days = defineModel('days', { type: Array, default: () => [] });

const TYPES = [
  { value: 'none', label: 'No se repite' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
];

function setType(value) {
  if (value !== type.value) days.value = [];
  type.value = value;
}

function toggle(d) {
  days.value = days.value.includes(d) ? days.value.filter((x) => x !== d) : [...days.value, d].sort((a, b) => a - b);
}
</script>

<template>
  <div class="recurrence">
    <div class="segmented" role="radiogroup" aria-label="Repetición">
      <button
        v-for="t in TYPES"
        :key="t.value"
        type="button"
        role="radio"
        :aria-checked="type === t.value"
        :class="{ active: type === t.value }"
        @click="setType(t.value)"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="type === 'weekly'" class="days weekly">
      <button
        v-for="(d, i) in WEEK_ORDER"
        :key="d"
        type="button"
        class="day"
        :class="{ active: days.includes(d) }"
        :aria-pressed="days.includes(d)"
        :title="WEEKDAY_NAMES[d]"
        @click="toggle(d)"
      >
        {{ WEEKDAYS_SHORT[i] }}
      </button>
    </div>

    <div v-else-if="type === 'monthly'" class="days monthly">
      <button
        v-for="d in 31"
        :key="d"
        type="button"
        class="day"
        :class="{ active: days.includes(d) }"
        :aria-pressed="days.includes(d)"
        @click="toggle(d)"
      >
        {{ d }}
      </button>
      <p class="hint monthly-hint">Si el mes no tiene ese día (p. ej. 31), se usa el último día del mes.</p>
    </div>
  </div>
</template>

<style scoped>
.recurrence {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.segmented {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  align-self: flex-start;
}
.segmented button {
  padding: var(--space-2) var(--space-4);
  border: 0;
  background: transparent;
  font-size: var(--fs-sm);
  cursor: pointer;
  transition: background var(--transition);
}
.segmented button + button {
  border-left: 1px solid var(--color-border);
}
.segmented button.active {
  background: var(--color-text);
  color: var(--color-bg);
  font-weight: 700;
}
.days {
  display: grid;
  gap: var(--space-1);
}
.weekly {
  grid-template-columns: repeat(7, 1fr);
}
.monthly {
  grid-template-columns: repeat(7, 1fr);
}
.day {
  height: 38px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: var(--fs-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition);
}
.day:hover {
  border-color: var(--color-text-muted);
}
.day.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}
.monthly-hint {
  grid-column: 1 / -1;
}
</style>
