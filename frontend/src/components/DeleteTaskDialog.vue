<script setup>
import { computed, ref } from 'vue';
import { useTasksStore } from '../stores/tasks.js';
import { describeRecurrence, formatLong } from '../utils/dates.js';
import BaseModal from './BaseModal.vue';

const props = defineProps({
  task: { type: Object, required: true },
  /** Fecha de la repetición desde la que se pide borrar (null si no se conoce) */
  date: { type: String, default: null },
});
const emit = defineEmits(['close', 'deleted']);

const store = useTasksStore();
const recurring = computed(() => props.task.recurrenceType !== 'none');
const busy = ref(false);
const error = ref('');

async function run(fn) {
  busy.value = true;
  error.value = '';
  try {
    await fn();
    emit('deleted');
    emit('close');
  } catch (err) {
    error.value = err.message;
    busy.value = false;
  }
}

const removeOne = () => run(() => store.removeOccurrence(props.task.id, props.date));
const removeFollowing = () => run(() => store.removeOccurrence(props.task.id, props.date, 'following'));
const removeAll = () => run(() => store.remove(props.task.id));
</script>

<template>
  <BaseModal title="Eliminar tarea" width="440px" @close="emit('close')">
    <p class="lead">
      <strong>{{ task.title }}</strong>
    </p>
    <template v-if="recurring">
      <p class="muted">↻ {{ describeRecurrence(task) }}</p>
      <p class="question">Esta tarea se repite. ¿Qué quieres eliminar?</p>
      <div class="options">
        <button v-if="date" class="option" type="button" :disabled="busy" @click="removeOne">
          <span class="title">Solo esta</span>
          <span class="muted">La del {{ formatLong(date).toLowerCase() }}. Las demás se mantienen.</span>
        </button>
        <button v-if="date" class="option" type="button" :disabled="busy" @click="removeFollowing">
          <span class="title">Esta y las siguientes</span>
          <span class="muted">Desde el {{ formatLong(date).toLowerCase() }} en adelante. Las anteriores se mantienen.</span>
        </button>
        <button class="option danger" type="button" :disabled="busy" @click="removeAll">
          <span class="title">Todas las repeticiones</span>
          <span class="muted">Se borra la tarea completa, incluido su historial de completadas.</span>
        </button>
      </div>
    </template>
    <p v-else class="question">¿Seguro que quieres eliminar esta tarea?</p>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <template #footer>
      <button class="btn btn-ghost" type="button" @click="emit('close')">Cancelar</button>
      <button v-if="!recurring" class="btn btn-primary" type="button" :disabled="busy" @click="removeAll">Eliminar</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.lead {
  font-size: var(--fs-lg);
}
.question {
  margin: var(--space-4) 0 var(--space-3);
}
.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition);
}
.option:hover {
  border-color: var(--color-text);
  background: var(--color-surface-hover);
}
.option.danger:hover {
  border-color: var(--color-danger);
}
.option.danger .title {
  color: var(--color-danger);
}
.option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.title {
  font-weight: 700;
}
.option .muted {
  font-size: var(--fs-sm);
}
.form-error {
  margin-top: var(--space-3);
}
</style>
