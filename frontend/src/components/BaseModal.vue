<script setup>
import { onBeforeUnmount, onMounted } from 'vue';

defineProps({
  title: { type: String, default: '' },
  width: { type: String, default: '520px' },
});
const emit = defineEmits(['close']);

function onKey(e) {
  if (e.key === 'Escape') emit('close');
}
onMounted(() => {
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @mousedown.self="emit('close')">
      <section class="modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ maxWidth: width }">
        <header v-if="title" class="modal-header">
          <h2>{{ title }}</h2>
          <button class="btn btn-icon close" type="button" aria-label="Cerrar" @click="emit('close')">✕</button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: var(--color-overlay);
  animation: fade-in 150ms ease;
}
.modal {
  width: 100%;
  max-height: calc(100dvh - 2 * var(--space-4));
  display: flex;
  flex-direction: column;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  animation: pop-in 180ms ease;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}
.modal-header h2 {
  font-size: var(--fs-lg);
}
.close {
  background: transparent;
}
.modal-body {
  padding: var(--space-5);
  overflow-y: auto;
}
.modal-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--color-border);
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
}
</style>
