import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api/client.js';

export const useTasksStore = defineStore('tasks', () => {
  const occurrences = ref([]);
  const members = ref([]);
  const categories = ref([]);
  /** null = todas las categorías */
  const categoryFilter = ref(null);
  const loading = ref(false);
  const onlyMine = ref(false);
  let lastRange = null;

  const membersById = computed(() => new Map(members.value.map((m) => [m.id, m])));
  const categoriesById = computed(() => new Map(categories.value.map((c) => [c.id, c])));

  async function loadMembers() {
    members.value = (await api.get('/users')).users;
  }

  async function loadCategories() {
    if (!categories.value.length) categories.value = (await api.get('/categories')).categories;
  }

  async function load(from, to) {
    lastRange = { from, to };
    loading.value = true;
    try {
      const qs = new URLSearchParams({ from, to, mine: String(onlyMine.value) });
      occurrences.value = (await api.get(`/calendar?${qs}`)).occurrences;
    } finally {
      loading.value = false;
    }
  }

  function reload() {
    return lastRange ? load(lastRange.from, lastRange.to) : Promise.resolve();
  }

  /** Ocurrencias visibles en un día (incluye tareas de varios días que lo cubren). */
  function forDay(date) {
    return occurrences.value.filter(
      (o) =>
        o.date <= date &&
        o.endDate >= date &&
        (categoryFilter.value === null || o.task.categoryId === categoryFilter.value),
    );
  }

  async function save(task, id) {
    const result = id ? await api.put(`/tasks/${id}`, task) : await api.post('/tasks', task);
    await reload();
    return result.task;
  }

  async function remove(id) {
    await api.del(`/tasks/${id}`);
    await reload();
  }

  async function removeOccurrence(id, date) {
    await api.del(`/tasks/${id}/occurrences/${date}`);
    await reload();
  }

  async function toggleComplete(occ) {
    const path = `/tasks/${occ.taskId}/complete/${occ.date}`;
    const wasCompleted = occ.completed;
    occ.completed = !wasCompleted; // actualización optimista
    try {
      if (wasCompleted) await api.del(path);
      else await api.post(path);
    } catch (err) {
      occ.completed = wasCompleted;
      throw err;
    }
  }

  return {
    occurrences,
    members,
    membersById,
    categories,
    categoriesById,
    categoryFilter,
    loading,
    onlyMine,
    loadMembers,
    loadCategories,
    load,
    reload,
    forDay,
    save,
    remove,
    removeOccurrence,
    toggleComplete,
  };
});
