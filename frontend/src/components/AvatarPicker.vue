<script setup>
import { ref } from 'vue';

const props = defineProps({
  presets: { type: Array, required: true },
  modelValue: { type: String, default: '' },
  /** Permite subir una foto propia (solo cuando el usuario ya existe) */
  allowUpload: { type: Boolean, default: false },
  uploading: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'upload']);

const fileInput = ref(null);

function onFile(e) {
  const file = e.target.files?.[0];
  if (file) emit('upload', file);
  e.target.value = '';
}
</script>

<template>
  <div class="picker">
    <div class="grid" role="radiogroup" aria-label="Elige un avatar">
      <button
        v-for="p in props.presets"
        :key="p"
        type="button"
        role="radio"
        class="option"
        :class="{ selected: p === modelValue }"
        :aria-checked="p === modelValue"
        @click="emit('update:modelValue', p)"
      >
        <img class="avatar" :src="`/media/avatars/${p}`" alt="" />
      </button>
      <button
        v-if="allowUpload"
        type="button"
        class="option upload"
        :disabled="uploading"
        @click="fileInput.click()"
      >
        <span>{{ uploading ? 'Subiendo…' : '＋ Subir foto' }}</span>
      </button>
    </div>
    <input ref="fileInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="onFile" />
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: var(--space-3);
}
.option {
  position: relative;
  padding: 0;
  border: 3px solid transparent;
  border-radius: var(--radius-md);
  background: none;
  cursor: pointer;
  transition: transform var(--transition), border-color var(--transition);
}
.option:hover {
  transform: scale(1.06);
}
.option.selected {
  border-color: var(--color-text);
}
.option .avatar {
  width: 100%;
}
.upload {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border: 2px dashed var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--fs-xs);
  font-weight: 600;
}
.upload:hover {
  border-color: var(--color-text);
  color: var(--color-text);
}
</style>
