<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api/client.js';
import { useAuthStore } from '../stores/auth.js';
import PasswordModal from '../components/PasswordModal.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const profiles = ref([]);
const allowRegistration = ref(false);
const loaded = ref(false);
const loadError = ref('');
const selected = ref(null);
const loginError = ref('');
const loggingIn = ref(false);
const manageMode = ref(false);

const visibleProfiles = computed(() =>
  manageMode.value ? profiles.value.filter((p) => p.role === 'admin') : profiles.value,
);

onMounted(async () => {
  try {
    const data = await api.get('/profiles');
    profiles.value = data.profiles;
    allowRegistration.value = data.allowRegistration;
  } catch (err) {
    loadError.value = err.message;
  } finally {
    loaded.value = true;
  }
});

function choose(profile) {
  loginError.value = '';
  selected.value = profile;
}

async function login(password) {
  loggingIn.value = true;
  loginError.value = '';
  try {
    await auth.login(selected.value.id, password);
    const next = manageMode.value ? '/admin' : (route.query.next ?? '/');
    router.replace(next);
  } catch (err) {
    loginError.value = err.message;
  } finally {
    loggingIn.value = false;
  }
}
</script>

<template>
  <main class="profiles">
    <div class="brand">HOME<span>calendar</span></div>

    <section class="who">
      <h1>{{ manageMode ? 'Administrar perfiles' : 'Crea tus tareas' }}</h1>
      <p v-if="manageMode" class="muted">Entra con un perfil administrador</p>

      <p v-if="loadError" class="form-error">No se pudo conectar con el servidor: {{ loadError }}</p>

      <ul v-if="loaded" class="grid">
        <li v-for="p in visibleProfiles" :key="p.id">
          <button class="tile" type="button" @click="choose(p)">
            <span class="tile-img">
              <img class="avatar" :src="p.avatar" :alt="''" />
              <span v-if="manageMode" class="edit-overlay">✎</span>
            </span>
            <span class="tile-name">{{ p.name }}</span>
            <span v-if="p.role === 'admin'" class="tile-badge">Admin</span>
          </button>
        </li>
        <li v-if="allowRegistration && !manageMode">
          <RouterLink to="/profiles/new" class="tile add">
            <span class="tile-img add-img"><span>＋</span></span>
            <span class="tile-name">Añadir perfil</span>
          </RouterLink>
        </li>
      </ul>

      <button class="manage" type="button" @click="manageMode = !manageMode">
        {{ manageMode ? 'Listo' : 'Administrar perfiles' }}
      </button>
    </section>

    <PasswordModal
      v-if="selected"
      :profile="selected"
      :error="loginError"
      :loading="loggingIn"
      @submit="login"
      @cancel="selected = null"
    />
  </main>
</template>

<style scoped>
.profiles {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(ellipse at top, #1d1d1d 0%, #141414 55%, #0b0b0b 100%);
}
.brand {
  padding: var(--space-5) var(--space-6);
  color: var(--color-accent);
  font-weight: 900;
  font-size: 2rem;
  letter-spacing: -0.03em;
}
.brand span {
  margin-left: 2px;
  font-size: var(--fs-md);
  font-weight: 400;
  color: var(--color-text-muted);
}
.who {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-5);
  padding: var(--space-4) var(--space-4) var(--space-7);
  text-align: center;
  animation: rise 400ms ease;
}
h1 {
  font-size: var(--fs-2xl);
  font-weight: 500;
}
.grid {
  list-style: none;
  margin: var(--space-4) 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(1rem, 2.5vw, 2rem);
}
.tile {
  --size: clamp(84px, 11vw, 150px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  width: var(--size);
  padding: 0;
  background: none;
  border: 0;
  cursor: pointer;
  text-decoration: none;
  color: var(--color-text-muted);
}
.tile-img {
  position: relative;
  display: block;
  width: 100%;
  border: 3px solid transparent;
  border-radius: var(--radius-sm);
  transition: border-color var(--transition), transform var(--transition);
}
.tile-img .avatar {
  width: 100%;
}
.tile:hover .tile-img,
.tile:focus-visible .tile-img {
  border-color: #fff;
  transform: scale(1.05);
}
.tile:hover,
.tile:focus-visible {
  color: #fff;
}
.tile:focus-visible {
  outline: none;
}
.tile-name {
  font-size: clamp(0.85rem, 1.4vw, 1.2rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.tile-badge {
  margin-top: calc(-1 * var(--space-2));
  font-size: var(--fs-xs);
  color: var(--color-accent);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.add-img {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
}
.add-img span {
  display: grid;
  place-items: center;
  width: 60%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #333;
  font-size: clamp(1.8rem, 4vw, 3.5rem);
  color: var(--color-text-muted);
  transition: background var(--transition), color var(--transition);
}
.add:hover .add-img span {
  background: #fff;
  color: #141414;
}
.edit-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.55);
  font-size: 2rem;
  color: #fff;
}
.manage {
  padding: var(--space-2) var(--space-5);
  border: 1px solid var(--color-text-muted);
  background: none;
  color: var(--color-text-muted);
  font-size: var(--fs-md);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color var(--transition), border-color var(--transition);
}
.manage:hover {
  color: #fff;
  border-color: #fff;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: scale(1.06);
  }
}
</style>
