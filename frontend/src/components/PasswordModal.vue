<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
  profile: { type: Object, required: true },
  error: { type: String, default: '' },
  loading: { type: Boolean, default: false },
});
const emit = defineEmits(['submit', 'cancel']);

const password = ref('');
const input = ref(null);

onMounted(() => input.value?.focus());

function submit() {
  if (password.value) emit('submit', password.value);
}
</script>

<template>
  <div class="lock" @keydown.esc="emit('cancel')">
    <button class="back" type="button" @click="emit('cancel')">✕</button>
    <div class="content">
      <p class="muted">El perfil está protegido</p>
      <img class="avatar" :src="props.profile.avatar" alt="" />
      <h2>Ingresa la contraseña de <strong>{{ props.profile.name }}</strong></h2>
      <form @submit.prevent="submit">
        <input
          ref="input"
          v-model="password"
          class="lock-input"
          :class="{ shake: props.error }"
          type="password"
          autocomplete="current-password"
          placeholder="Contraseña"
          aria-label="Contraseña"
        />
        <p class="lock-error" role="alert">{{ props.error }}</p>
        <button class="btn btn-primary lock-submit" type="submit" :disabled="!password || props.loading">
          {{ props.loading ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.lock {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: var(--color-lock-bg);
  animation: appear 200ms ease;
}
.back {
  position: absolute;
  top: var(--space-5);
  right: var(--space-5);
  width: 44px;
  height: 44px;
  font-size: 1.5rem;
  background: none;
  border: 0;
  cursor: pointer;
}
.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
  width: min(420px, 100%);
}
.avatar {
  width: 120px;
}
h2 {
  font-size: var(--fs-xl);
  font-weight: 400;
}
form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.lock-input {
  width: 100%;
  height: 56px;
  padding: 0 var(--space-4);
  border: 2px solid var(--color-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: var(--fs-lg);
  text-align: center;
  letter-spacing: 0.2em;
}
.lock-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}
.lock-input.shake {
  border-color: var(--color-danger);
  animation: shake 300ms;
}
.lock-error {
  min-height: 1.4em;
  color: var(--color-danger);
  font-size: var(--fs-sm);
}
.lock-submit {
  height: 48px;
  font-size: var(--fs-md);
}
@keyframes appear {
  from {
    opacity: 0;
    transform: scale(1.04);
  }
}
@keyframes shake {
  25% {
    transform: translateX(-8px);
  }
  75% {
    transform: translateX(8px);
  }
}
</style>
