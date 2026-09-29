<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../api/client.js';
import { useAuthStore } from '../stores/auth.js';
import AvatarPicker from '../components/AvatarPicker.vue';

const auth = useAuthStore();
const presets = ref([]);
const uploading = ref(false);
const message = ref('');
const error = ref('');

const profile = reactive({ name: auth.user.name, color: auth.user.color });
const pwd = reactive({ currentPassword: '', newPassword: '', confirm: '' });

const COLORS = ['#e50914', '#ff7a00', '#f5c518', '#2ecc71', '#00b8a9', '#0071eb', '#9b59b6', '#ff4f9a'];
const selectedPreset = computed(() => (auth.user.avatarType === 'preset' ? auth.user.avatarValue : ''));
const pwdValid = computed(() => pwd.currentPassword && pwd.newPassword.length >= 8 && pwd.newPassword === pwd.confirm);

onMounted(async () => {
  presets.value = (await api.get('/profiles')).presets;
});

async function run(fn, okMsg) {
  message.value = '';
  error.value = '';
  try {
    const { user } = await fn();
    auth.setUser(user);
    message.value = okMsg;
  } catch (err) {
    error.value = err.message;
  }
}

const saveProfile = () => run(() => api.patch('/users/me', { name: profile.name.trim(), color: profile.color }), 'Perfil actualizado');
const choosePreset = (avatar) => run(() => api.patch('/users/me', { avatar }), 'Avatar actualizado');

async function upload(file) {
  uploading.value = true;
  const form = new FormData();
  form.append('avatar', file);
  await run(() => api.post('/users/me/avatar', form), 'Foto actualizada');
  uploading.value = false;
}

async function changePassword() {
  await run(
    () => api.patch('/users/me', { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword }),
    'Contraseña cambiada',
  );
  if (!error.value) Object.assign(pwd, { currentPassword: '', newPassword: '', confirm: '' });
}
</script>

<template>
  <main class="page settings">
    <h1>Mi perfil</h1>

    <p v-if="message" class="ok" role="status">{{ message }}</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <section class="card">
      <h2>Imagen</h2>
      <div class="avatar-row">
        <img class="avatar current" :src="auth.user.avatar" alt="Avatar actual" />
        <AvatarPicker :presets="presets" :model-value="selectedPreset" allow-upload :uploading="uploading" @update:model-value="choosePreset" @upload="upload" />
      </div>
    </section>

    <section class="card">
      <h2>Datos</h2>
      <form class="stack" @submit.prevent="saveProfile">
        <label class="field">
          <span>Nombre</span>
          <input v-model="profile.name" class="input" maxlength="40" required />
        </label>
        <div class="field">
          <span>Color en el calendario</span>
          <div class="colors">
            <button
              v-for="c in COLORS"
              :key="c"
              type="button"
              class="swatch"
              :class="{ active: profile.color === c }"
              :style="{ background: c }"
              :aria-label="`Color ${c}`"
              @click="profile.color = c"
            />
          </div>
        </div>
        <button class="btn btn-primary" type="submit">Guardar</button>
      </form>
    </section>

    <section class="card">
      <h2>Contraseña</h2>
      <form class="stack" @submit.prevent="changePassword">
        <label class="field">
          <span>Contraseña actual</span>
          <input v-model="pwd.currentPassword" class="input" type="password" autocomplete="current-password" />
        </label>
        <label class="field">
          <span>Nueva contraseña</span>
          <input v-model="pwd.newPassword" class="input" type="password" autocomplete="new-password" />
          <small class="hint" :class="{ ok: pwd.newPassword.length >= 8 }">Mínimo 8 caracteres</small>
        </label>
        <label class="field">
          <span>Repite la nueva contraseña</span>
          <input v-model="pwd.confirm" class="input" type="password" autocomplete="new-password" />
          <small v-if="pwd.confirm && pwd.confirm !== pwd.newPassword" class="hint error">No coinciden</small>
        </label>
        <button class="btn btn-primary" type="submit" :disabled="!pwdValid">Cambiar contraseña</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.settings {
  max-width: 760px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
h1 {
  font-size: var(--fs-xl);
}
h2 {
  font-size: var(--fs-lg);
  margin-bottom: var(--space-4);
}
.avatar-row {
  display: flex;
  gap: var(--space-5);
  align-items: flex-start;
}
.current {
  width: 110px;
  flex-shrink: 0;
}
.avatar-row > :last-child {
  flex: 1;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: flex-start;
}
.stack .field {
  width: 100%;
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
}
.ok {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: rgba(46, 204, 113, 0.12);
  color: var(--color-success);
  font-size: var(--fs-sm);
}
@media (max-width: 560px) {
  .avatar-row {
    flex-direction: column;
    align-items: center;
  }
}
</style>
