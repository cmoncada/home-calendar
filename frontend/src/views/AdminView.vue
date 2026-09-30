<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api/client.js';
import { useAuthStore } from '../stores/auth.js';
import BaseModal from '../components/BaseModal.vue';

const auth = useAuthStore();

const users = ref([]);
const tokens = ref([]);
const error = ref('');
const message = ref('');

const newUser = reactive({ open: false, name: '', password: '', role: 'member' });
const resetFor = ref(null);
const resetPassword = ref('');
const newToken = ref(null);
const tokenLabel = ref('ESP32 cocina');

const ROLE_LABEL = { admin: 'Administrador', member: 'Miembro', display: 'Pantalla ESP32' };

async function load() {
  const [u, t] = await Promise.all([api.get('/admin/users'), api.get('/admin/display-tokens')]);
  users.value = u.users;
  tokens.value = t.tokens;
}

async function run(fn, okMsg) {
  error.value = '';
  message.value = '';
  try {
    await fn();
    if (okMsg) message.value = okMsg;
    await load();
    return true;
  } catch (err) {
    error.value = err.message;
    return false;
  }
}

async function createUser() {
  const ok = await run(
    () => api.post('/admin/users', { name: newUser.name.trim(), password: newUser.password, role: newUser.role }),
    `Usuario ${newUser.name} creado`,
  );
  if (ok) Object.assign(newUser, { open: false, name: '', password: '', role: 'member' });
}

const toggleActive = (u) =>
  run(() => api.patch(`/admin/users/${u.id}`, { isActive: !u.isActive }), u.isActive ? `${u.name} desactivado` : `${u.name} activado`);

const changeRole = (u, role) => run(() => api.patch(`/admin/users/${u.id}`, { role }), `Rol de ${u.name} actualizado`);

function removeUser(u) {
  if (!confirm(`¿Eliminar a ${u.name}? Se borrarán sus asignaciones.`)) return;
  run(() => api.del(`/admin/users/${u.id}`), `${u.name} eliminado`);
}

async function doReset() {
  const ok = await run(
    () => api.patch(`/admin/users/${resetFor.value.id}`, { password: resetPassword.value }),
    `Contraseña de ${resetFor.value.name} restablecida`,
  );
  if (ok) {
    resetFor.value = null;
    resetPassword.value = '';
  }
}

async function createToken() {
  error.value = '';
  try {
    newToken.value = await api.post('/admin/display-tokens', { label: tokenLabel.value });
    await load();
  } catch (err) {
    error.value = err.message;
  }
}

function revokeToken(t) {
  if (!confirm(`¿Revocar el token "${t.label}"? El dispositivo dejará de funcionar.`)) return;
  run(() => api.del(`/admin/display-tokens/${t.id}`), 'Token revocado');
}

async function copy(text) {
  await navigator.clipboard?.writeText(text).catch(() => {});
  message.value = 'Copiado al portapapeles';
}

const fmtDate = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('es') : '—');
const endpoint = `${location.origin}/api/display/today`;

onMounted(() => load().catch((err) => (error.value = err.message)));
</script>

<template>
  <main class="page admin">
    <div class="page-head">
      <h1>Administración</h1>
      <RouterLink to="/admin/dashboard" class="btn btn-primary">📊 Ver dashboard</RouterLink>
    </div>

    <p v-if="message" class="ok" role="status">{{ message }}</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <section class="card">
      <div class="section-head">
        <h2>Usuarios</h2>
        <button class="btn btn-primary" type="button" @click="newUser.open = true">＋ Nuevo usuario</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Perfil</th>
              <th>Rol</th>
              <th>Tareas</th>
              <th>Estado</th>
              <th class="right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" :class="{ inactive: !u.isActive }">
              <td>
                <span class="who">
                  <img class="avatar" :src="u.avatar" alt="" />
                  <strong>{{ u.name }}</strong>
                  <span v-if="u.id === auth.user.id" class="badge">Tú</span>
                </span>
              </td>
              <td>
                <select
                  v-if="u.role !== 'display' && u.id !== auth.user.id"
                  class="input select"
                  :value="u.role"
                  @change="changeRole(u, $event.target.value)"
                >
                  <option value="member">Miembro</option>
                  <option value="admin">Administrador</option>
                </select>
                <span v-else class="badge" :class="{ 'badge-accent': u.role === 'admin' }">{{ ROLE_LABEL[u.role] }}</span>
              </td>
              <td>{{ u.role === 'display' ? '—' : u.taskCount }}</td>
              <td>
                <span class="status" :class="u.isActive ? 'on' : 'off'">{{ u.isActive ? 'Activo' : 'Inactivo' }}</span>
              </td>
              <td class="right">
                <div v-if="u.role !== 'display'" class="actions">
                  <button class="btn btn-ghost" type="button" @click="resetFor = u">Contraseña</button>
                  <button v-if="u.id !== auth.user.id" class="btn btn-ghost" type="button" @click="toggleActive(u)">
                    {{ u.isActive ? 'Desactivar' : 'Activar' }}
                  </button>
                  <button v-if="u.id !== auth.user.id" class="btn btn-danger" type="button" @click="removeUser(u)">Eliminar</button>
                </div>
                <span v-else class="muted small">Acceso solo por token</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <h2>Pantalla ESP32</h2>
      </div>
      <p class="muted small">
        El dispositivo consulta <code>GET {{ endpoint }}</code> con la cabecera
        <code>Authorization: Bearer &lt;token&gt;</code> y recibe un JSON compacto con las tareas del día.
      </p>

      <form class="token-form" @submit.prevent="createToken">
        <input v-model="tokenLabel" class="input" maxlength="80" placeholder="Nombre del dispositivo" required />
        <button class="btn btn-primary" type="submit">Generar token</button>
      </form>

      <div v-if="newToken" class="new-token">
        <p><strong>Token para "{{ newToken.label }}"</strong> — cópialo ahora, no se volverá a mostrar.</p>
        <div class="token-box">
          <code>{{ newToken.token }}</code>
          <button class="btn btn-ghost" type="button" @click="copy(newToken.token)">Copiar</button>
        </div>
        <pre class="curl">curl -H "Authorization: Bearer {{ newToken.token }}" {{ endpoint }}</pre>
      </div>

      <div class="table-wrap">
        <table v-if="tokens.length">
          <thead>
            <tr>
              <th>Dispositivo</th>
              <th>Token</th>
              <th>Último uso</th>
              <th>Estado</th>
              <th class="right"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tokens" :key="t.id" :class="{ inactive: t.revokedAt }">
              <td>{{ t.label }}</td>
              <td><code>…{{ t.hint }}</code></td>
              <td>{{ fmtDate(t.lastUsedAt) }}</td>
              <td>
                <span class="status" :class="t.revokedAt ? 'off' : 'on'">{{ t.revokedAt ? 'Revocado' : 'Activo' }}</span>
              </td>
              <td class="right">
                <button v-if="!t.revokedAt" class="btn btn-danger" type="button" @click="revokeToken(t)">Revocar</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted small">Aún no hay tokens.</p>
      </div>
    </section>

    <BaseModal v-if="newUser.open" title="Nuevo usuario" @close="newUser.open = false">
      <form id="new-user" class="stack" @submit.prevent="createUser">
        <label class="field">
          <span>Nombre</span>
          <input v-model="newUser.name" class="input" maxlength="40" required />
        </label>
        <label class="field">
          <span>Contraseña</span>
          <input v-model="newUser.password" class="input" type="password" minlength="8" autocomplete="new-password" required />
          <small class="hint" :class="{ ok: newUser.password.length >= 8 }">Mínimo 8 caracteres</small>
        </label>
        <label class="field">
          <span>Rol</span>
          <select v-model="newUser.role" class="input">
            <option value="member">Miembro</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
      </form>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="newUser.open = false">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="new-user" :disabled="newUser.password.length < 8">Crear</button>
      </template>
    </BaseModal>

    <BaseModal v-if="resetFor" :title="`Nueva contraseña para ${resetFor.name}`" @close="resetFor = null">
      <form id="reset" class="stack" @submit.prevent="doReset">
        <label class="field">
          <span>Nueva contraseña</span>
          <input v-model="resetPassword" class="input" type="password" minlength="8" autocomplete="new-password" required />
          <small class="hint" :class="{ ok: resetPassword.length >= 8 }">Mínimo 8 caracteres</small>
        </label>
      </form>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="resetFor = null">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="reset" :disabled="resetPassword.length < 8">Guardar</button>
      </template>
    </BaseModal>
  </main>
</template>

<style scoped>
.admin {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
h1 {
  font-size: var(--fs-xl);
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}
h2 {
  font-size: var(--fs-lg);
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}
.small {
  font-size: var(--fs-sm);
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
th,
td {
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}
th {
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.right {
  text-align: right;
}
tr.inactive {
  opacity: 0.5;
}
.who {
  display: inline-flex;
  align-items: center;
  min-width: max-content;
  gap: var(--space-2);
}
.who .avatar {
  width: 32px;
  flex-shrink: 0;
}
.select {
  min-height: 34px;
  width: auto;
  padding: 0 var(--space-2);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
.actions .btn {
  min-height: 32px;
  padding: 0 var(--space-3);
}
.status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.status::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status.on::before {
  background: var(--color-success);
}
.status.off::before {
  background: var(--color-text-faint);
}
code,
pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
}
.token-form {
  display: flex;
  gap: var(--space-2);
  margin: var(--space-4) 0;
  max-width: 520px;
}
.new-token {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  background: rgba(245, 197, 24, 0.07);
}
.token-box {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
}
.token-box code {
  padding: var(--space-2) var(--space-3);
  background: #0b0b0b;
  border-radius: var(--radius-sm);
  word-break: break-all;
}
.curl {
  margin: 0;
  padding: var(--space-3);
  background: #0b0b0b;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  color: var(--color-text-muted);
}
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.ok {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: rgba(46, 204, 113, 0.12);
  color: var(--color-success);
  font-size: var(--fs-sm);
}
</style>
