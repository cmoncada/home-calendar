<script setup>
defineProps({
  occ: { type: Object, required: true },
  showTime: { type: Boolean, default: true },
});
</script>

<template>
  <span class="chip" :class="{ done: occ.completed }" :style="{ '--c': occ.task.color }" :title="occ.task.title">
    <span v-if="showTime && occ.startTime" class="time">{{ occ.startTime }}</span>
    <span class="title">{{ occ.task.title }}</span>
  </span>
</template>

<style scoped>
.chip {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  padding: 2px var(--space-2);
  border-left: 3px solid var(--c);
  border-radius: 3px;
  background: color-mix(in srgb, var(--c) 22%, transparent);
  font-size: var(--fs-xs);
  line-height: 1.5;
}
.time {
  flex-shrink: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.done {
  opacity: 0.5;
}
.done .title {
  text-decoration: line-through;
}
</style>
