<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client.js';
import { useAuthStore } from '../stores/auth.js';
import AvatarPicker from '../components/AvatarPicker.vue';

const auth = useAuthStore();
const router = useRouter();

const presets = ref([]);
const name = ref('');
const password = ref('');
const confirm = ref('');
const avatar = ref('avatar-01.svg');
const photo = ref(null);
const photoUrl = ref('');
const error = ref('');
const saving = ref(false);

const passwordOk = computed(() => password.value.length >= 8);
const confirmOk = computed(() => confirm.value.length > 0 && confirm.value === password.value);
const canSubmit = computed(() => name.value.trim().length >= 2 && passwordOk.value && confirmOk.value && !saving.value);
const preview = computed(() => photoUrl.value || `/media/avatars/${avatar.value}`);

onMounted(async () => {
  const data = await api.get('/profiles');
  presets.value = data.presets;
  if (!data.allowRegistration) router.replace({ name: 'profiles' });
});

function clearPhoto() {
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value);
  photo.value = null;
  photoUrl.value = '';
}
onBeforeUnmount(clearPhoto);

function pickPreset(p) {
  clearPhoto();
  avatar.value = p;
}

function pickPhoto(file) {
  if (file.size > 2 * 1024 * 1024) {
    error.value = 'La imagen supera 2 MB';
    return;
  }
  clearPhoto();
  photo.value = file;
  photoUrl.value = URL.createObjectURL(file);
}

async function submit() {
  if (!canSubmit.value) return;
  saving.value = true;
  error.value = '';
  try {
    await auth.register({ name: name.value.trim(), password: password.value, avatar: avatar.value });
    if (photo.value) {
      const form = new FormData();
      form.append('avatar', photo.value);
      const { user } = await api.post('/users/me/avatar', form).catch(() => ({}));
      if (user) auth.setUser(user);
    }
    router.replace('/');
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="add">
    <form class="panel" @submit.prevent="submit">
      <h1>Añadir perfil</h1>
      <p class="muted">Crea un perfil para cada persona del hogar.</p>

      <div class="identity">
        <img class="avatar big" :src="preview" alt="Vista previa del avatar" />
        <div class="fields">
          <label class="field">
            <span>Nombre</span>
            <input v-model="name" class="input" maxlength="40" autocomplete="off" placeholder="Ej. Ana" required />
          </label>
          <label class="field">
            <span>Contraseña</span>
            <input
              v-model="password"
              class="input"
              :class="{ 'is-invalid': password && !passwordOk }"
              type="password"
              autocomplete="new-password"
              required
            />
            <small class="hint" :class="{ ok: passwordOk, error: password && !passwordOk }">
              {{ passwordOk ? '✓ Longitud correcta' : `Mínimo 8 caracteres (${password.length}/8)` }}
            </small>
          </label>
          <label class="field">
            <span>Repite la contraseña</span>
            <input
              v-model="confirm"
              class="input"
              :class="{ 'is-invalid': confirm && !confirmOk }"
              type="password"
              autocomplete="new-password"
              required
            />
            <small v-if="confirm && !confirmOk" class="hint error">Las contraseñas no coinciden</small>
          </label>
        </div>
      </div>

      <div class="field">
        <span>Elige tu imagen</span>
        <AvatarPicker :presets="presets" :model-value="photo ? '' : avatar" allow-upload @update:model-value="pickPreset" @upload="pickPhoto" />
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <div class="actions">
        <button class="btn btn-primary" type="submit" :disabled="!canSubmit">
          {{ saving ? 'Creando…' : 'Continuar' }}
        </button>
        <RouterLink to="/login" class="btn btn-ghost">Cancelar</RouterLink>
      </div>
    </form>
  </main>
</template>

<style scoped>
.add {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--space-5) var(--space-4);
}
.panel {
  width: min(640px, 100%);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: rise 300ms ease;
}
h1 {
  font-size: var(--fs-2xl);
  font-weight: 500;
}
.panel > .muted {
  margin-top: calc(-1 * var(--space-4));
  padding-bottom: var(--space-4);
  border-bottom: 1px solid #333;
}
.identity {
  display: flex;
  gap: var(--space-5);
  align-items: flex-start;
}
.big {
  width: 128px;
  flex-shrink: 0;
}
.fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.actions {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid #333;
}
.actions .btn {
  min-width: 140px;
  height: 46px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
@media (max-width: 560px) {
  .identity {
    flex-direction: column;
    align-items: center;
  }
  .fields {
    width: 100%;
  }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: scale(1.04);
  }
}
</style>
