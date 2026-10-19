import './polyfills.js'; // primero: antes de que se evalúe nada que los use
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router.js';
import { setUnauthorizedHandler } from './api/client.js';
import { useAuthStore } from './stores/auth.js';
import './styles/tokens.css';
import './styles/base.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);

setUnauthorizedHandler(() => {
  useAuthStore().setUser(null);
  if (router.currentRoute.value.name !== 'profiles') router.push({ name: 'profiles' });
});

app.mount('#app');

// PWA: el service worker solo en producción (en desarrollo interferiría con la recarga de Vite).
// Los navegadores solo lo permiten en HTTPS o en localhost.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker no registrado:', err.message));
  });
}
