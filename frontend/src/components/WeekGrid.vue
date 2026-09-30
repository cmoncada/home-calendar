<script setup>
import { computed } from 'vue';
import { WEEKDAY_NAMES, addDays, dayOfMonth, today, weekday } from '../utils/dates.js';
import TaskChip from './TaskChip.vue';

const props = defineProps({
  weekStart: { type: String, required: true },
  forDay: { type: Function, required: true },
});
const emit = defineEmits(['open-day', 'create', 'toggle']);

const todayStr = today();

const days = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const date = addDays(props.weekStart, i);
    return { date, name: WEEKDAY_NAMES[weekday(date)], day: dayOfMonth(date), isToday: date === todayStr, items: props.forDay(date) };
  }),
);
</script>

<template>
  <div class="week">
    <section v-for="d in days" :key="d.date" class="col" :class="{ today: d.isToday }">
      <button type="button" class="col-head" @click="emit('open-day', d.date)">
        <span class="name">{{ d.name }}</span>
        <span class="num">{{ d.day }}</span>
      </button>
      <ul class="list">
        <li v-for="o in d.items" :key="`${o.taskId}-${o.date}`" class="row">
          <input
            type="checkbox"
            :checked="o.completed"
            :aria-label="`Completar ${o.task.title}`"
            @change="emit('toggle', o)"
          />
          <TaskChip :occ="o" class="grow" />
        </li>
        <li v-if="!d.items.length" class="empty">Libre</li>
      </ul>
      <button type="button" class="add" @click="emit('create', d.date)">＋ Añadir</button>
    </section>
  </div>
</template>

<style scoped>
.week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-2);
}
.col {
  display: flex;
  flex-direction: column;
  min-height: 320px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.col.today {
  border-color: var(--color-accent);
}
.col-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  cursor: pointer;
}
.col-head:hover {
  background: var(--color-surface-hover);
}
.name {
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}
.num {
  font-size: var(--fs-lg);
  font-weight: 700;
}
.today .num {
  color: var(--color-accent);
}
.list {
  list-style: none;
  margin: 0;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.row input {
  accent-color: var(--color-accent);
  flex-shrink: 0;
}
.grow {
  flex: 1;
}
.add {
  margin-top: auto;
  padding: var(--space-2);
  border: 0;
  border-top: 1px dashed var(--color-border);
  background: none;
  color: var(--color-text-faint);
  font-size: var(--fs-xs);
  cursor: pointer;
  transition: color var(--transition), background var(--transition);
}
.add:hover {
  color: var(--color-text);
  background: var(--color-surface);
}
.empty {
  font-size: var(--fs-xs);
  color: var(--color-text-faint);
  padding: var(--space-2);
}
@media (max-width: 900px) {
  .week {
    grid-template-columns: 1fr;
  }
  .col {
    min-height: 0;
  }
}
</style>
