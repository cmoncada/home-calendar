<script setup>
import { computed } from 'vue';
import { WEEKDAY_NAMES, WEEK_ORDER, addDays, dayOfMonth, startOfMonth, startOfWeek, today } from '../utils/dates.js';
import TaskChip from './TaskChip.vue';

const props = defineProps({
  month: { type: String, required: true },
  forDay: { type: Function, required: true },
});
const emit = defineEmits(['select-day']);

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
    <button
      v-for="cell in days"
      :key="cell.date"
      type="button"
      class="cell"
      :class="{ outside: cell.outside, today: cell.isToday }"
      @click="emit('select-day', cell.date)"
    >
      <span class="num">{{ cell.day }}</span>
      <span class="items">
        <TaskChip v-for="o in cell.items" :key="`${o.taskId}-${o.date}`" :occ="o" />
        <span v-if="cell.more" class="more">+{{ cell.more }} más</span>
      </span>
      <span v-if="cell.pending" class="dot" :aria-label="`${cell.pending} pendientes`">{{ cell.pending }}</span>
    </button>
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
.cell.outside {
  background: #101010;
}
.cell.outside .num {
  color: var(--color-text-faint);
}
.num {
  font-size: var(--fs-sm);
  font-weight: 600;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
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
.more {
  font-size: var(--fs-xs);
  color: var(--color-text-muted);
  padding-left: var(--space-1);
}
.dot {
  display: none;
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
