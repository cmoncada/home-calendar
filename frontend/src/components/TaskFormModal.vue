<script setup>
import { computed, reactive, ref } from 'vue';
import { useTasksStore } from '../stores/tasks.js';
import { useAuthStore } from '../stores/auth.js';
import { today } from '../utils/dates.js';
import BaseModal from './BaseModal.vue';
import RecurrencePicker from './RecurrencePicker.vue';
import DeleteTaskDialog from './DeleteTaskDialog.vue';

const props = defineProps({
  /** Tarea a editar (null = nueva) */
  task: { type: Object, default: null },
  defaultDate: { type: String, default: '' },
  /** Repetición desde la que se abrió la edición (permite borrar solo esa) */
  occurrenceDate: { type: String, default: null },
});
const emit = defineEmits(['close', 'saved']);

const store = useTasksStore();
const auth = useAuthStore();

const COLORS = ['#e50914', '#ff7a00', '#f5c518', '#2ecc71', '#00b8a9', '#0071eb', '#9b59b6', '#ff4f9a'];

const t = props.task;
const form = reactive({
  title: t?.title ?? '',
  notes: t?.notes ?? '',
  categoryId: t?.categoryId ?? null,
  isPrivate: t?.isPrivate ?? false,
  color: t?.color ?? COLORS[0],
  startDate: t?.startDate ?? (props.defaultDate || today()),
  allDay: t ? !t.startTime : false,
  startTime: t?.startTime ?? '09:00',
  durationValue: t?.durationValue ?? 1,
  durationUnit: t?.durationUnit ?? 'hours',
  recurrenceType: t?.recurrenceType ?? 'none',
  recurrenceDays: [...(t?.recurrenceDays ?? [])],
  recurrenceInterval: t?.recurrenceInterval ?? 15,
  hasUntil: Boolean(t?.recurrenceUntil),
  recurrenceUntil: t?.recurrenceUntil ?? '',
  assignees: [...(t?.assignees ?? [auth.user.id])],
});

const error = ref('');
const saving = ref(false);
const confirmingDelete = ref(false);
const isEdit = computed(() => Boolean(props.task));
// Solo quien crea la tarea puede marcarla o desmarcarla como privada
const canSetPrivate = computed(() => !props.task || props.task.createdBy === auth.user.id);
const maxDuration = computed(() => (form.durationUnit === 'hours' ? 168 : 365));

function chooseCategory(c) {
  if (form.categoryId === c.id) {
    form.categoryId = null;
    return;
  }
  form.categoryId = c.id;
  form.color = c.color;
}

function toggleAssignee(id) {
  form.assignees = form.assignees.includes(id) ? form.assignees.filter((a) => a !== id) : [...form.assignees, id];
}

function payload() {
  return {
    title: form.title,
    notes: form.notes || null,
    categoryId: form.categoryId,
    isPrivate: form.isPrivate,
    color: form.color,
    startDate: form.startDate,
    startTime: form.allDay ? null : form.startTime,
    durationValue: Number(form.durationValue),
    durationUnit: form.durationUnit,
    recurrenceType: form.recurrenceType,
    recurrenceDays: form.recurrenceDays,
    recurrenceInterval: form.recurrenceType === 'interval' ? Number(form.recurrenceInterval) : null,
    recurrenceUntil: form.recurrenceType !== 'none' && form.hasUntil ? form.recurrenceUntil || null : null,
    assignees: form.isPrivate ? [auth.user.id] : form.assignees,
  };
}

async function submit() {
  error.value = '';
  if (['weekly', 'monthly'].includes(form.recurrenceType) && !form.recurrenceDays.length) {
    error.value = form.recurrenceType === 'weekly' ? 'Elige al menos un día de la semana' : 'Elige al menos un día del mes';
    return;
  }
  saving.value = true;
  try {
    const saved = await store.save(payload(), props.task?.id);
    emit('saved', saved);
    emit('close');
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

</script>

<template>
  <BaseModal :title="isEdit ? 'Editar tarea' : 'Nueva tarea'" width="620px" @close="emit('close')">
    <form id="task-form" class="form" @submit.prevent="submit">
      <label class="field">
        <span>Nombre de la tarea</span>
        <input v-model="form.title" class="input" maxlength="120" placeholder="Ej. Sacar la basura" required autofocus />
      </label>

      <div class="field">
        <span>Categoría</span>
        <div class="categories">
          <button
            v-for="c in store.categories"
            :key="c.id"
            type="button"
            class="category"
            :class="{ active: form.categoryId === c.id }"
            :style="{ '--c': c.color }"
            :aria-pressed="form.categoryId === c.id"
            @click="chooseCategory(c)"
          >
            <span aria-hidden="true">{{ c.icon }}</span> {{ c.name }}
          </button>
        </div>
      </div>

      <div class="row">
        <label class="field">
          <span>Fecha</span>
          <input v-model="form.startDate" class="input" type="date" required />
        </label>
        <label class="field">
          <span>Hora</span>
          <input v-model="form.startTime" class="input" type="time" :disabled="form.allDay" />
        </label>
        <label class="check">
          <input v-model="form.allDay" type="checkbox" />
          Todo el día
        </label>
      </div>

      <div class="field">
        <span>Duración</span>
        <div class="duration">
          <input v-model.number="form.durationValue" class="input num" type="number" min="1" :max="maxDuration" required />
          <div class="segmented">
            <button type="button" :class="{ active: form.durationUnit === 'hours' }" @click="form.durationUnit = 'hours'">Horas</button>
            <button type="button" :class="{ active: form.durationUnit === 'days' }" @click="form.durationUnit = 'days'">Días</button>
          </div>
        </div>
      </div>

      <div class="field">
        <span>Repetición</span>
        <RecurrencePicker
          v-model:type="form.recurrenceType"
          v-model:days="form.recurrenceDays"
          v-model:interval="form.recurrenceInterval"
        />
        <div v-if="form.recurrenceType !== 'none'" class="until">
          <label class="check">
            <input v-model="form.hasUntil" type="checkbox" />
            Termina el
          </label>
          <input v-model="form.recurrenceUntil" class="input" type="date" :min="form.startDate" :disabled="!form.hasUntil" />
        </div>
      </div>

      <label v-if="canSetPrivate" class="private" :class="{ on: form.isPrivate }">
        <input v-model="form.isPrivate" type="checkbox" role="switch" />
        <span class="switch" aria-hidden="true"></span>
        <span class="private-text">
          <strong>🔒 Tarea privada</strong>
          <small class="muted">Solo tú la verás en tu calendario. No aparece a los demás ni en la pantalla del ESP32.</small>
        </span>
      </label>

      <div v-if="!form.isPrivate" class="field">
        <span>Responsables</span>
        <div class="people">
          <button
            v-for="m in store.members"
            :key="m.id"
            type="button"
            class="person"
            :class="{ active: form.assignees.includes(m.id) }"
            :aria-pressed="form.assignees.includes(m.id)"
            @click="toggleAssignee(m.id)"
          >
            <img class="avatar" :src="m.avatar" alt="" />
            <span>{{ m.name }}</span>
          </button>
        </div>
      </div>

      <div class="field">
        <span>Color</span>
        <div class="colors">
          <button
            v-for="c in COLORS"
            :key="c"
            type="button"
            class="swatch"
            :class="{ active: form.color === c }"
            :style="{ background: c }"
            :aria-label="`Color ${c}`"
            @click="form.color = c"
          />
        </div>
      </div>

      <label class="field">
        <span>Notas (opcional)</span>
        <textarea v-model="form.notes" class="input" maxlength="2000" rows="2" />
      </label>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </form>

    <template #footer>
      <button v-if="isEdit" class="btn btn-danger delete" type="button" :disabled="saving" @click="confirmingDelete = true">Eliminar</button>
      <button class="btn btn-ghost" type="button" @click="emit('close')">Cancelar</button>
      <button class="btn btn-primary" type="submit" form="task-form" :disabled="saving">
        {{ saving ? 'Guardando…' : 'Guardar' }}
      </button>
    </template>
  </BaseModal>
  <DeleteTaskDialog
    v-if="confirmingDelete"
    :task="task"
    :date="occurrenceDate"
    @close="confirmingDelete = false"
    @deleted="emit('close')"
  />
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--space-3);
  align-items: end;
}
.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  font-size: var(--fs-sm);
  cursor: pointer;
  white-space: nowrap;
}
.check input,
.people input {
  accent-color: var(--color-accent);
  width: 18px;
  height: 18px;
}
.duration {
  display: flex;
  gap: var(--space-3);
}
.num {
  width: 100px;
}
.segmented {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.segmented button {
  padding: 0 var(--space-4);
  border: 0;
  background: transparent;
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
.until {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}
.until .input {
  max-width: 200px;
}
.private {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition);
}
.private.on {
  border-color: var(--color-text-muted);
  background: var(--color-surface);
}
.private input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.switch {
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--color-surface-hover);
  transition: background var(--transition);
}
.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-text-muted);
  transition: transform var(--transition), background var(--transition);
}
.private.on .switch {
  background: var(--color-accent);
}
.private.on .switch::after {
  transform: translateX(18px);
  background: #fff;
}
.private input:focus-visible + .switch {
  outline: 2px solid var(--color-text);
  outline-offset: 2px;
}
.private-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--fs-sm);
}
.private-text small {
  font-size: var(--fs-xs);
}
.categories {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.category {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  font-size: var(--fs-sm);
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition);
}
.category:hover {
  border-color: var(--c);
}
.category.active {
  border-color: var(--c);
  background: color-mix(in srgb, var(--c) 22%, transparent);
  font-weight: 600;
}
.people {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.person {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  font-size: var(--fs-sm);
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition);
}
.person .avatar {
  width: 28px;
  border-radius: 50%;
}
.person.active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  font-weight: 600;
}
.colors {
  display: flex;
  gap: var(--space-2);
}
.swatch {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
}
.swatch.active {
  border-color: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-bg-elevated) inset;
}
.delete {
  margin-right: auto;
}
@media (max-width: 560px) {
  .row {
    grid-template-columns: 1fr 1fr;
  }
  .check {
    grid-column: 1 / -1;
    min-height: 0;
  }
}
</style>
