import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth.js';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'profiles', component: () => import('./views/ProfilesView.vue'), meta: { guest: true } },
    { path: '/profiles/new', name: 'add-profile', component: () => import('./views/AddProfileView.vue'), meta: { guest: true } },
    { path: '/', name: 'calendar', component: () => import('./views/CalendarView.vue') },
    { path: '/day/:date', name: 'day', component: () => import('./views/DayView.vue'), props: true },
    { path: '/profile', name: 'settings', component: () => import('./views/ProfileSettingsView.vue') },
    { path: '/admin/dashboard', name: 'dashboard', component: () => import('./views/DashboardView.vue'), meta: { admin: true } },
    { path: '/admin', name: 'admin', component: () => import('./views/AdminView.vue'), meta: { admin: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.checked) await auth.fetchMe();

  if (to.meta.guest) return auth.user ? { name: 'calendar' } : true;
  if (!auth.user) return { name: 'profiles', query: to.fullPath !== '/' ? { next: to.fullPath } : {} };
  if (to.meta.admin && !auth.isAdmin) return { name: 'calendar' };
  return true;
});

export default router;
