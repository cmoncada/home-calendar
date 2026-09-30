<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  /** [{ key, label, generated, completed, unfinished, pending }] */
  series: { type: Array, required: true },
  /** Muestra cursor de clic y emite `select` con la key de la barra */
  clickable: { type: Boolean, default: false },
  height: { type: Number, default: 280 },
});
const emit = defineEmits(['select']);

const SEGMENTS = [
  { key: 'completed', label: 'Completadas', color: 'var(--chart-completed)' },
  { key: 'unfinished', label: 'Sin terminar', color: 'var(--chart-unfinished)' },
  { key: 'pending', label: 'Pendientes', color: 'var(--chart-pending)' },
];
const PAD = { top: 16, right: 12, bottom: 28, left: 36 };

const wrap = ref(null);
const width = ref(0);
const hover = ref(null);
let observer;

onMounted(() => {
  width.value = Math.max(280, wrap.value.clientWidth);
  observer = new ResizeObserver(([entry]) => (width.value = Math.max(280, entry.contentRect.width)));
  observer.observe(wrap.value);
});
onBeforeUnmount(() => observer?.disconnect());

/** Escala "bonita": máximo redondeado y 4-5 marcas enteras. */
const scale = computed(() => {
  const max = Math.max(1, ...props.series.map((s) => s.generated));
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough));
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
});

const plotW = computed(() => width.value - PAD.left - PAD.right);
const plotH = computed(() => props.height - PAD.top - PAD.bottom);
const slot = computed(() => plotW.value / Math.max(1, props.series.length));
const barW = computed(() => Math.max(4, Math.min(48, slot.value * 0.66)));
const y = (v) => PAD.top + plotH.value - (v / scale.value.top) * plotH.value;

/** Si no caben todas las etiquetas, se muestra una de cada N. */
const labelEvery = computed(() => {
  const longest = Math.max(1, ...props.series.map((s) => s.label.length));
  const needed = Math.max(18, longest * 7 + 6);
  return Math.max(1, Math.ceil(needed / slot.value));
});

const bars = computed(() =>
  props.series.map((s, i) => {
    const x = PAD.left + slot.value * i + (slot.value - barW.value) / 2;
    let acc = 0;
    const parts = SEGMENTS.filter((seg) => s[seg.key] > 0).map((seg) => {
      const y0 = y(acc);
      acc += s[seg.key];
      const y1 = y(acc);
      return { key: seg.key, color: seg.color, y: y1, h: Math.max(0, y0 - y1) };
    });
    return { ...s, i, x, cx: x + barW.value / 2, parts, showLabel: i % labelEvery.value === 0 };
  }),
);

const tooltip = computed(() => {
  if (hover.value === null) return null;
  const b = bars.value[hover.value];
  if (!b) return null;
  const left = Math.min(Math.max(b.cx, 90), width.value - 90);
  return { ...b, left, top: y(b.generated) };
});
</script>

<template>
  <div class="chart" @mouseleave="hover = null">
    <div ref="wrap" class="svg-box">
    <svg v-if="width" :width="width" :height="height" role="img" aria-label="Gráfica de tareas por periodo">
      <g class="grid">
        <g v-for="t in scale.ticks" :key="t">
          <line :x1="PAD.left" :x2="width - PAD.right" :y1="y(t)" :y2="y(t)" />
          <text :x="PAD.left - 8" :y="y(t)" text-anchor="end" dominant-baseline="middle">{{ t }}</text>
        </g>
      </g>

      <g
        v-for="b in bars"
        :key="b.key"
        class="bar"
        :class="{ dim: hover !== null && hover !== b.i, clickable }"
        @mouseenter="hover = b.i"
        @click="clickable && emit('select', b.key)"
      >
        <!-- Área de interacción de toda la columna -->
        <rect class="hit" :x="PAD.left + slot * b.i" :y="PAD.top" :width="slot" :height="plotH" />
        <rect
          v-for="p in b.parts"
          :key="p.key"
          :x="b.x"
          :y="p.y"
          :width="barW"
          :height="p.h"
          :fill="p.color"
          rx="2"
        />
        <text v-if="b.showLabel" class="xlabel" :x="b.cx" :y="height - 8" text-anchor="middle">{{ b.label }}</text>
      </g>
    </svg>
    </div>

    <div v-if="tooltip" class="tooltip" :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }">
      <strong>{{ tooltip.label }}</strong>
      <span>Generadas: <b>{{ tooltip.generated }}</b></span>
      <span v-for="seg in SEGMENTS" :key="seg.key">
        <i :style="{ background: seg.color }" />{{ seg.label }}: <b>{{ tooltip[seg.key] }}</b>
      </span>
      <small v-if="clickable" class="muted">Clic para ver el detalle</small>
    </div>

    <ul class="legend">
      <li v-for="seg in SEGMENTS" :key="seg.key"><i :style="{ background: seg.color }" />{{ seg.label }}</li>
    </ul>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
  min-width: 0;
}
/* El SVG nunca debe ensanchar su contenedor (evita un bucle con el ResizeObserver).
   Solo se recorta esta caja, no el tooltip. */
.svg-box {
  width: 100%;
  overflow: hidden;
}
svg {
  display: block;
}
.grid line {
  stroke: var(--color-border);
  stroke-dasharray: 2 4;
}
.grid text,
.xlabel {
  fill: var(--color-text-muted);
  font-size: 11px;
}
.hit {
  fill: transparent;
}
.bar rect:not(.hit) {
  transition: opacity var(--transition);
}
.bar.dim rect:not(.hit) {
  opacity: 0.35;
}
.bar.clickable {
  cursor: pointer;
}
.bar:hover .hit {
  fill: rgba(255, 255, 255, 0.03);
}
.tooltip {
  position: absolute;
  z-index: 5;
  transform: translate(-50%, calc(-100% - 10px));
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 170px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: rgba(10, 10, 10, 0.95);
  box-shadow: var(--shadow-lg);
  font-size: var(--fs-xs);
  pointer-events: none;
  white-space: nowrap;
}
.tooltip strong {
  font-size: var(--fs-sm);
  margin-bottom: 2px;
}
.tooltip i,
.legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 2px;
  vertical-align: -1px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-4);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
  font-size: var(--fs-sm);
  color: var(--color-text-muted);
}
</style>
