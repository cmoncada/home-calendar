<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTasksStore } from '../stores/tasks.js';
import {
  addDays,
  addMonths,
  formatMonthYear,
  formatShort,
  startOfMonth,
  startOfWeek,
  today,
} from '../utils/dates.js';
import MonthGrid from '../components/MonthGrid.vue';
import WeekGrid from '../components/WeekGrid.vue';
import TaskFormModal from '../components/TaskFormModal.vue';

const store = useTasksStore();
const router = useRouter();
const route = useRoute();

function readPref(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible */
  }
}

const mode = ref(readPref('hc.view', window.innerWidth < 720 ? 'week' : 'month'));
// ?date=YYYY-MM-DD abre el calendario en esa fecha (p. ej. al volver desde la vista de día)
const cursor = ref(/^\d{4}-\d{2}-\d{2}$/.test(route.query.date ?? '') ? route.query.date : today());
const showForm = ref(false);
const formDate = ref(today());
const error = ref('');

const range = computed(() => {
  if (mode.value === 'week') {
    const from = startOfWeek(cursor.value);
    return { from, to: addDays(from, 6) };
  }
  const from = startOfWeek(startOfMonth(cursor.value));
  return { from, to: addDays(from, 41) };
});

const title = computed(() =>
  mode.value === 'week'
    ? `${formatShort(range.value.from)} – ${formatShort(range.value.to)}`
    : formatMonthYear(cursor.value),
);

async function load() {
  error.value = '';
  try {
    await store.load(range.value.from, range.value.to);
  } catch (err) {
    error.value = err.message;
  }
}

function move(step) {
  cursor.value = mode.value === 'week' ? addDays(cursor.value, step * 7) : addMonths(cursor.value, step);
}

function openCreate(date) {
  formDate.value = date;
  showForm.value = true;
}

function openDay(date) {
  router.push({ name: 'day', params: { date } });
}

function setMode(value) {
  mode.value = value;
  writePref('hc.view', value);
}

async function toggle(occ) {
  try {
    await store.toggleComplete(occ);
  } catch (err) {
    error.value = err.message;
  }
}

watch(range, load);
watch(() => store.onlyMine, load);
onMounted(() => {
  store.loadMembers();
  store.loadCategories();
  load();
});
</script>

<template>
  <main class="page calendar">
    <div class="toolbar">
      <div class="nav">
        <button class="btn btn-ghost btn-icon" type="button" aria-label="Anterior" @click="move(-1)">‹</button>
        <button class="btn btn-ghost" type="button" @click="cursor = today()">Hoy</button>
        <button class="btn btn-ghost btn-icon" type="button" aria-label="Siguiente" @click="move(1)">›</button>
        <h1>{{ title }}</h1>
      </div>

      <div class="controls">
        <select v-model="store.categoryFilter" class="input category-filter" aria-label="Filtrar por categoría">
          <option :value="null">Todas las categorías</option>
          <option v-for="c in store.categories" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
        </select>
        <label class="mine">
          <input v-model="store.onlyMine" type="checkbox" />
          Solo mis tareas
        </label>
        <div class="segmented" role="radiogroup" aria-label="Vista">
          <button type="button" :class="{ active: mode === 'month' }" @click="setMode('month')">Mes</button>
          <button type="button" :class="{ active: mode === 'week' }" @click="setMode('week')">Semana</button>
        </div>
        <button class="btn btn-primary" type="button" @click="openCreate(today())">＋ Nueva tarea</button>
      </div>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <div class="grid-wrap" :class="{ loading: store.loading }">
      <MonthGrid
        v-if="mode === 'month'"
        :month="startOfMonth(cursor)"
        :for-day="store.forDay"
        @create="openCreate"
        @open-day="openDay"
      />
      <WeekGrid
        v-else
        :week-start="range.from"
        :for-day="store.forDay"
        @create="openCreate"
        @open-day="openDay"
        @toggle="toggle"
      />
    </div>

    <TaskFormModal v-if="showForm" :default-date="formDate" @close="showForm = false" />
  </main>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.nav,
.controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
h1 {
  margin-left: var(--space-3);
  font-size: var(--fs-xl);
  font-weight: 700;
}
.btn-icon {
  font-size: 1.4rem;
}
.category-filter {
  width: auto;
  min-height: 40px;
  padding: 0 var(--space-3);
}
.mine {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fs-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  margin-right: var(--space-2);
}
.mine input {
  accent-color: var(--color-accent);
}
.segmented {
  display: inline-flex;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.segmented button {
  padding: 0 var(--space-4);
  border: 0;
  background: transparent;
  font-size: var(--fs-sm);
  cursor: pointer;
}
.segmented button + button {
  border-left: 1px solid var(--color-border);
}
.segmented button.active {
  background: var(--color-text);
  color: var(--color-bg);
  font-weight: 700;
}
.grid-wrap {
  transition: opacity var(--transition);
}
.grid-wrap.loading {
  opacity: 0.6;
}
.form-error {
  margin-bottom: var(--space-3);
}
@media (max-width: 600px) {
  h1 {
    width: 100%;
    margin: var(--space-2) 0 0;
    order: -1;
  }
}
</style>
