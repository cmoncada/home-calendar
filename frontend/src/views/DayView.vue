<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTasksStore } from '../stores/tasks.js';
import { addDays, describeRecurrence, formatDuration, formatLong, formatShort, today } from '../utils/dates.js';
import TaskFormModal from '../components/TaskFormModal.vue';

const props = defineProps({ date: { type: String, required: true } });

const store = useTasksStore();
const router = useRouter();

const day = computed(() => (props.date === 'today' || !/^\d{4}-\d{2}-\d{2}$/.test(props.date) ? today() : props.date));
const items = computed(() => store.forDay(day.value));
const done = computed(() => items.value.filter((o) => o.completed).length);
const progress = computed(() => (items.value.length ? Math.round((done.value / items.value.length) * 100) : 0));

const editing = ref(null);
const creating = ref(false);
const error = ref('');

async function load() {
  error.value = '';
  try {
    await store.load(day.value, day.value);
  } catch (err) {
    error.value = err.message;
  }
}

function go(step) {
  router.push({ name: 'day', params: { date: addDays(day.value, step) } });
}

function category(o) {
  return store.categoriesById.get(o.task.categoryId);
}

function member(id) {
  return store.membersById.get(id);
}

function timeLabel(o) {
  if (o.date !== day.value) return `Continúa desde ${formatShort(o.date)}`;
  if (!o.startTime) return 'Todo el día';
  return o.endTime ? `${o.startTime} – ${o.endTime}` : o.startTime;
}

async function toggle(o) {
  try {
    await store.toggleComplete(o);
  } catch (err) {
    error.value = err.message;
  }
}

async function removeOccurrence(o) {
  const recurring = o.task.recurrenceType !== 'none';
  const msg = recurring ? '¿Eliminar solo esta repetición de la tarea?' : '¿Eliminar esta tarea?';
  if (!confirm(msg)) return;
  try {
    await store.removeOccurrence(o.taskId, o.date);
  } catch (err) {
    error.value = err.message;
  }
}

watch(day, load);
onMounted(() => {
  if (!store.members.length) store.loadMembers();
  store.loadCategories();
  load();
});
</script>

<template>
  <main class="page day">
    <div class="head">
      <div class="nav">
        <button class="btn btn-ghost btn-icon" type="button" aria-label="Día anterior" @click="go(-1)">‹</button>
        <button class="btn btn-ghost btn-icon" type="button" aria-label="Día siguiente" @click="go(1)">›</button>
        <div>
          <p class="muted small">{{ day === today() ? 'Hoy' : 'Día' }}</p>
          <h1>{{ formatLong(day) }}</h1>
        </div>
      </div>
      <button class="btn btn-primary" type="button" @click="creating = true">＋ Nueva tarea</button>
    </div>

    <div v-if="items.length" class="progress" :aria-label="`${done} de ${items.length} completadas`">
      <div class="bar"><span :style="{ width: `${progress}%` }" /></div>
      <span class="muted small">{{ done }}/{{ items.length }} completadas</span>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <ul v-if="items.length" class="list">
      <li
        v-for="o in items"
        :key="`${o.taskId}-${o.date}`"
        class="item"
        :class="{ done: o.completed }"
        :style="{ '--c': o.task.color }"
      >
        <label class="check">
          <input type="checkbox" :checked="o.completed" @change="toggle(o)" />
          <span class="box" aria-hidden="true">✓</span>
          <span class="visually-hidden">Completar {{ o.task.title }}</span>
        </label>

        <div class="info">
          <span v-if="category(o)" class="category" :style="{ '--cc': category(o).color }">
            {{ category(o).icon }} {{ category(o).name }}
          </span>
          <h2>{{ o.task.title }}</h2>
          <p class="meta">
            <span>{{ timeLabel(o) }}</span>
            <span>· {{ formatDuration(o.task.durationValue, o.task.durationUnit) }}</span>
            <span v-if="describeRecurrence(o.task)">· ↻ {{ describeRecurrence(o.task) }}</span>
          </p>
          <p v-if="o.task.notes" class="notes">{{ o.task.notes }}</p>
          <div class="people">
            <span v-for="id in o.task.assignees" :key="id" class="person">
              <img v-if="member(id)" class="avatar" :src="member(id).avatar" alt="" />
              {{ member(id)?.name ?? 'Usuario' }}
            </span>
            <span v-if="!o.task.assignees.length" class="muted small">Sin responsable</span>
          </div>
          <p v-if="o.completed && o.completedBy" class="muted small">
            Hecha por {{ member(o.completedBy)?.name ?? 'alguien' }}
          </p>
        </div>

        <div class="actions">
          <button class="btn btn-ghost" type="button" @click="editing = o.task">Editar</button>
          <button class="btn btn-ghost btn-icon" type="button" aria-label="Eliminar" title="Eliminar" @click="removeOccurrence(o)">🗑</button>
        </div>
      </li>
    </ul>

    <div v-else-if="!store.loading" class="empty card">
      <p class="big">🎉</p>
      <p>No hay tareas para este día.</p>
    </div>

    <TaskFormModal v-if="creating" :default-date="day" @close="creating = false" />
    <TaskFormModal v-if="editing" :task="editing" @close="editing = null" />
  </main>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.nav {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.nav > div {
  margin-left: var(--space-3);
}
h1 {
  font-size: var(--fs-xl);
}
.small {
  font-size: var(--fs-sm);
}
.btn-icon {
  font-size: 1.4rem;
}
.progress {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--color-surface);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  background: var(--color-accent);
  transition: width 300ms ease;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.item {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
  padding: var(--space-4);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-left: 5px solid var(--c);
  border-radius: var(--radius-md);
  transition: opacity var(--transition);
}
.item.done {
  opacity: 0.6;
}
.item.done h2 {
  text-decoration: line-through;
}
.check {
  position: relative;
  cursor: pointer;
}
.check input {
  position: absolute;
  opacity: 0;
  inset: 0;
  cursor: pointer;
}
.box {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 2px solid var(--color-text-muted);
  border-radius: 50%;
  color: transparent;
  font-weight: 900;
  transition: background var(--transition), border-color var(--transition), color var(--transition);
}
.check input:checked + .box {
  background: var(--color-success);
  border-color: var(--color-success);
  color: #0b0b0b;
}
.check input:focus-visible + .box {
  outline: 2px solid var(--color-text);
  outline-offset: 2px;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
h2 {
  font-size: var(--fs-lg);
}
.category {
  align-self: flex-start;
  padding: 1px var(--space-2);
  border-radius: 999px;
  background: color-mix(in srgb, var(--cc) 20%, transparent);
  color: var(--cc);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  font-size: var(--fs-sm);
  color: var(--color-text-muted);
}
.notes {
  font-size: var(--fs-sm);
  white-space: pre-line;
}
.people {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
.person {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2) 2px 2px;
  border-radius: 999px;
  background: var(--color-surface);
  font-size: var(--fs-xs);
}
.person .avatar {
  width: 20px;
  border-radius: 50%;
}
.actions {
  display: flex;
  gap: var(--space-2);
}
.empty {
  text-align: center;
  padding: var(--space-7) var(--space-4);
  color: var(--color-text-muted);
}
.big {
  font-size: 2.5rem;
}
@media (max-width: 600px) {
  .item {
    flex-wrap: wrap;
  }
  .actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
