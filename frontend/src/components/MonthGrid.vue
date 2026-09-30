<script setup>
import { computed } from 'vue';
import { WEEKDAY_NAMES, WEEK_ORDER, addDays, dayOfMonth, startOfMonth, startOfWeek, today } from '../utils/dates.js';
import TaskChip from './TaskChip.vue';

const props = defineProps({
  month: { type: String, required: true },
  forDay: { type: Function, required: true },
});
// create: clic en el hueco del día (nueva tarea); open-day: clic en el número o en una tarea
const emit = defineEmits(['create', 'open-day']);

const MAX_VISIBLE = 3;
const todayStr = today();

const days = computed(() => {
  const first = startOfWeek(startOfMonth(props.month));
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(first, i);
    const items = props.forDay(date);
    return {
      date,
      day: dayOfMonth(date),
      outside: date.slice(0, 7) !== props.month.slice(0, 7),
      isToday: date === todayStr,
      items: items.slice(0, MAX_VISIBLE),
      more: Math.max(0, items.length - MAX_VISIBLE),
      pending: items.filter((o) => !o.completed).length,
    };
  });
});
</script>

<template>
  <div class="month">
    <div v-for="d in WEEK_ORDER" :key="d" class="weekday">
      <span class="long">{{ WEEKDAY_NAMES[d] }}</span><span class="short">{{ WEEKDAY_NAMES[d].slice(0, 3) }}</span>
    </div>
    <div
      v-for="cell in days"
      :key="cell.date"
      class="cell"
      :class="{ outside: cell.outside, today: cell.isToday }"
      role="button"
      tabindex="0"
      :aria-label="`Nueva tarea el ${cell.date}`"
      @click="emit('create', cell.date)"
      @keydown.enter.self="emit('create', cell.date)"
    >
      <button type="button" class="num" :title="`Ver el día ${cell.day}`" @click.stop="emit('open-day', cell.date)">
        {{ cell.day }}
      </button>
      <span class="items">
        <button
          v-for="o in cell.items"
          :key="`${o.taskId}-${o.date}`"
          type="button"
          class="chip-btn"
          @click.stop="emit('open-day', cell.date)"
        >
          <TaskChip :occ="o" />
        </button>
        <button v-if="cell.more" type="button" class="more" @click.stop="emit('open-day', cell.date)">
          +{{ cell.more }} más
        </button>
      </span>
      <span v-if="cell.pending" class="dot" :aria-label="`${cell.pending} pendientes`">{{ cell.pending }}</span>
      <span class="add-hint" aria-hidden="true">＋</span>
    </div>
  </div>
</template>

<style scoped>
.month {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  background: #2a2a2a;
  border: 1px solid #2a2a2a;
  border-radius: var(--radius-md);
  overflow: hidden;
}
.weekday {
  padding: var(--space-2);
  background: var(--color-bg-elevated);
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  text-align: center;
}
.weekday .short {
  display: none;
}
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-height: 118px;
  padding: var(--space-2);
  border: 0;
  background: var(--color-bg);
  text-align: left;
  cursor: pointer;
  transition: background var(--transition);
}
.cell:hover {
  background: var(--color-bg-elevated);
}
.cell:focus-visible {
  outline: 2px solid var(--color-text);
  outline-offset: -2px;
}
.add-hint {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  color: var(--color-text-faint);
  opacity: 0;
  transition: opacity var(--transition);
}
.cell:hover .add-hint {
  opacity: 1;
}
.cell.outside {
  background: #101010;
}
.cell.outside .num {
  color: var(--color-text-faint);
}
.num {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  transition: background var(--transition);
  font-size: var(--fs-sm);
  font-weight: 600;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
}
.num:hover {
  background: var(--color-surface-hover);
}
.today .num {
  background: var(--color-accent);
  color: #fff;
}
.items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.chip-btn {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
}
.chip-btn:hover {
  filter: brightness(1.25);
}
.more {
  padding: 0 var(--space-1);
  border: 0;
  background: none;
  text-align: left;
  font-size: var(--fs-xs);
  color: var(--color-text-muted);
  cursor: pointer;
}
.more:hover {
  color: var(--color-text);
}
.dot {
  display: none;
}
@media (hover: none) {
  .add-hint {
    display: none;
  }
}
@media (max-width: 720px) {
  .weekday .long {
    display: none;
  }
  .weekday .short {
    display: inline;
  }
  .cell {
    min-height: 64px;
    align-items: center;
  }
  .items {
    display: none;
  }
  .dot {
    display: grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 4px;
    border-radius: 10px;
    background: var(--color-accent-soft);
    color: var(--color-accent-hover);
    font-size: var(--fs-xs);
    font-weight: 700;
  }
}
</style>
