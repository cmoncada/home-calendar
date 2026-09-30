import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api/client.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const checked = ref(false);

  const isAdmin = computed(() => user.value?.role === 'admin');

  /** Misma regla que el servidor: creador, responsable o administrador. */
  function canEditTask(task) {
    const me = user.value;
    if (!me || !task) return false;
    return me.role === 'admin' || task.createdBy === me.id || task.assignees.includes(me.id);
  }

  async function fetchMe() {
    try {
      user.value = (await api.get('/auth/me')).user;
    } catch {
      user.value = null;
    } finally {
      checked.value = true;
    }
    return user.value;
  }

  async function login(userId, password) {
    user.value = (await api.post('/auth/login', { userId, password })).user;
  }

  async function register(payload) {
    user.value = (await api.post('/auth/register', payload)).user;
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    user.value = null;
  }

  function setUser(next) {
    user.value = next;
  }

  return { user, checked, isAdmin, canEditTask, fetchMe, login, register, logout, setUser };
});
