<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import { useAuthStore } from './stores/auth.js';

const route = useRoute();
const auth = useAuthStore();
const showHeader = computed(() => route.name && !route.meta.guest && !route.meta.public && auth.user);
</script>

<template>
  <AppHeader v-if="showHeader" />
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 160ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
