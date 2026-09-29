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
