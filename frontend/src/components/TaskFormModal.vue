<script setup>
import { computed, reactive, ref } from 'vue';
import { useTasksStore } from '../stores/tasks.js';
import { useAuthStore } from '../stores/auth.js';
import { today } from '../utils/dates.js';
import BaseModal from './BaseModal.vue';
import RecurrencePicker from './RecurrencePicker.vue';

const props = defineProps({
  /** Tarea a editar (null = nueva) */
  task: { type: Object, default: null },
  defaultDate: { type: String, default: '' },
});
const emit = defineEmits(['close', 'saved']);

const store = useTasksStore();
const auth = useAuthStore();

const COLORS = ['#e50914', '#ff7a00', '#f5c518', '#2ecc71', '#00b8a9', '#0071eb', '#9b59b6', '#ff4f9a'];

const t = props.task;
const form = reactive({
  title: t?.title ?? '',
  notes: t?.notes ?? '',
  color: t?.color ?? COLORS[0],
  startDate: t?.startDate ?? (props.defaultDate || today()),
  allDay: t ? !t.startTime : false,
  startTime: t?.startTime ?? '09:00',
  durationValue: t?.durationValue ?? 1,
  durationUnit: t?.durationUnit ?? 'hours',
  recurrenceType: t?.recurrenceType ?? 'none',
  recurrenceDays: [...(t?.recurrenceDays ?? [])],
  hasUntil: Boolean(t?.recurrenceUntil),
  recurrenceUntil: t?.recurrenceUntil ?? '',
  assignees: [...(t?.assignees ?? [auth.user.id])],
});

const error = ref('');
const saving = ref(false);
const isEdit = computed(() => Boolean(props.task));
const maxDuration = computed(() => (form.durationUnit === 'hours' ? 168 : 365));

function toggleAssignee(id) {
  form.assignees = form.assignees.includes(id) ? form.assignees.filter((a) => a !== id) : [...form.assignees, id];
}

function payload() {
  return {
    title: form.title,
    notes: form.notes || null,
    color: form.color,
    startDate: form.startDate,
    startTime: form.allDay ? null : form.startTime,
    durationValue: Number(form.durationValue),
    durationUnit: form.durationUnit,
    recurrenceType: form.recurrenceType,
    recurrenceDays: form.recurrenceDays,
    recurrenceUntil: form.recurrenceType !== 'none' && form.hasUntil ? form.recurrenceUntil || null : null,
    assignees: form.assignees,
  };
}

async function submit() {
  error.value = '';
  if (form.recurrenceType !== 'none' && !form.recurrenceDays.length) {
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

async function removeTask() {
  const msg = props.task.recurrenceType === 'none'
    ? '¿Eliminar esta tarea?'
    : '¿Eliminar la tarea y TODAS sus repeticiones?';
  if (!confirm(msg)) return;
  saving.value = true;
  try {
    await store.remove(props.task.id);
    emit('close');
  } catch (err) {
    error.value = err.message;
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
        <RecurrencePicker v-model:type="form.recurrenceType" v-model:days="form.recurrenceDays" />
        <div v-if="form.recurrenceType !== 'none'" class="until">
          <label class="check">
            <input v-model="form.hasUntil" type="checkbox" />
            Termina el
          </label>
          <input v-model="form.recurrenceUntil" class="input" type="date" :min="form.startDate" :disabled="!form.hasUntil" />
        </div>
      </div>

      <div class="field">
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
      <button v-if="isEdit" class="btn btn-danger delete" type="button" :disabled="saving" @click="removeTask">Eliminar</button>
      <button class="btn btn-ghost" type="button" @click="emit('close')">Cancelar</button>
      <button class="btn btn-primary" type="submit" form="task-form" :disabled="saving">
        {{ saving ? 'Guardando…' : 'Guardar' }}
      </button>
    </template>
  </BaseModal>
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
