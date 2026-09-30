<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useTasksStore } from '../stores/tasks.js';

const auth = useAuthStore();
const router = useRouter();
const menuOpen = ref(false);

async function logout() {
  menuOpen.value = false;
  await auth.logout();
  useTasksStore().clear();
  // replace: evita volver con "atrás" a una página que ya requiere sesión
  await router.replace({ name: 'profiles' });
}
</script>

<template>
  <header class="header">
    <RouterLink to="/" class="brand">
      <span class="logo">HOME</span><span class="logo-sub">calendar</span>
    </RouterLink>

    <nav class="nav">
      <RouterLink to="/" class="nav-link">Calendario</RouterLink>
      <RouterLink :to="{ name: 'day', params: { date: 'today' } }" class="nav-link">Hoy</RouterLink>
      <RouterLink v-if="auth.isAdmin" to="/admin/dashboard" class="nav-link desktop-only">Dashboard</RouterLink>
      <RouterLink v-if="auth.isAdmin" to="/admin" class="nav-link desktop-only">Administrar</RouterLink>
    </nav>

    <div class="profile" @mouseleave="menuOpen = false">
      <button class="profile-btn" type="button" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
        <img class="avatar" :src="auth.user.avatar" alt="" />
        <span class="caret" :class="{ open: menuOpen }">▾</span>
      </button>
      <div v-if="menuOpen" class="menu" role="menu">
        <p class="menu-name">{{ auth.user.name }}</p>
        <RouterLink to="/profile" class="menu-item" role="menuitem" @click="menuOpen = false">Mi perfil</RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/admin/dashboard" class="menu-item" role="menuitem" @click="menuOpen = false">
          Dashboard
        </RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/admin" class="menu-item" role="menuitem" @click="menuOpen = false">
          Administrar usuarios
        </RouterLink>
        <hr class="menu-sep" />
        <button class="menu-item logout" type="button" role="menuitem" @click="logout">
          <span aria-hidden="true">⎋</span> Cerrar sesión
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: var(--space-5);
  height: var(--header-h);
  padding: 0 var(--space-4);
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.85), rgba(20, 20, 20, 0.95));
  backdrop-filter: blur(6px);
  border-bottom: 1px solid #222;
}
.brand {
  display: flex;
  align-items: baseline;
  gap: 2px;
  text-decoration: none;
}
.logo {
  color: var(--color-accent);
  font-weight: 900;
  font-size: 1.5rem;
  letter-spacing: -0.02em;
}
.logo-sub {
  font-size: var(--fs-sm);
  color: var(--color-text-muted);
}
.nav {
  display: flex;
  gap: var(--space-4);
  flex: 1;
}
.nav-link {
  font-size: var(--fs-sm);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color var(--transition);
}
.nav-link:hover,
.nav-link.router-link-exact-active {
  color: var(--color-text);
  font-weight: 600;
}
.profile {
  position: relative;
}
.profile-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0;
  background: none;
  border: 0;
  cursor: pointer;
}
.profile-btn .avatar {
  width: 34px;
}
.caret {
  transition: transform var(--transition);
}
.caret.open {
  transform: rotate(180deg);
}
.menu {
  position: absolute;
  right: 0;
  top: 100%;
  min-width: 200px;
  padding: var(--space-2) 0;
  background: rgba(0, 0, 0, 0.92);
  border: 1px solid #333;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
}
.menu-name {
  padding: var(--space-2) var(--space-4);
  font-weight: 700;
  border-bottom: 1px solid #333;
  margin-bottom: var(--space-1);
}
.menu-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-4);
  text-align: left;
  font-size: var(--fs-sm);
  text-decoration: none;
  background: none;
  border: 0;
  cursor: pointer;
}
.menu-item:hover {
  text-decoration: underline;
}
.menu-sep {
  margin: var(--space-1) 0;
  border: 0;
  border-top: 1px solid #333;
}
.logout {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
@media (max-width: 600px) {
  .header {
    gap: var(--space-3);
  }
  .logo-sub {
    display: none;
  }
  .nav {
    gap: var(--space-3);
  }
  /* En móvil estas opciones siguen en el menú del perfil */
  .desktop-only {
    display: none;
  }
}
</style>
