<script setup>
// Pantalla de televisor: tareas del día de todo el hogar en grande, solo lectura.
// Sin sesión: se identifica con un token de pantalla (el mismo tipo que el ESP32).
//   /tv?token=hc_…   la primera vez (el token se guarda en el televisor y se quita de la URL)
// Mando: ← → cambia de día · ↑ ↓ / OK pasa de página. Nunca muestra tareas privadas.
// Pensada para el navegador de televisores Samsung (Tizen 6.5, Chromium ~85): sin APIs ni CSS recientes.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { addDays, formatDuration, formatLong, formatShort } from '../utils/dates.js';
import { theme } from '../utils/theme.js';
import iconDark from '../images/icon_dark.svg';
import iconLight from '../images/icon_light.svg';

const TOKEN_KEY = 'hc.tv.token';
const PER_PAGE = 6;
const REFRESH_MS = 60 * 1000;
const RETRY_MS = 20 * 1000;
const PAGE_ROTATE_MS = 15 * 1000;
const IDLE_BACK_TO_TODAY_MS = 2 * 60 * 1000;
// Teclas del mando (Tizen las envía como teclas normales del navegador)
const KEY = { left: 37, up: 38, right: 39, down: 40, enter: 13 };

const route = useRoute();
const router = useRouter();

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}
function saveToken(value) {
  try {
    localStorage.setItem(TOKEN_KEY, value);
  } catch {
    /* almacenamiento no disponible: el token sigue en memoria */
  }
}

const token = ref(readToken());
const data = ref(null);
const viewDate = ref(null); // null = hoy (según el servidor)
const page = ref(0);
const status = ref('loading'); // loading | ok | unauthorized | error
const errorMsg = ref('');
const lastOk = ref(null);
const clock = ref('');

let refreshTimer = null;
let rotateTimer = null;
let clockTimer = null;
let lastInputAt = Date.now();
let requestSeq = 0; // descarta respuestas que llegan tarde (cambios de día rápidos)

const membersById = computed(() => {
  const map = new Map();
  for (const m of data.value?.members ?? []) map.set(m.id, m);
  return map;
});
const categoriesById = computed(() => {
  const map = new Map();
  for (const c of data.value?.categories ?? []) map.set(c.id, c);
  return map;
});
const tasks = computed(() => data.value?.tasks ?? []);
const pages = computed(() => Math.max(1, Math.ceil(tasks.value.length / PER_PAGE)));
const visible = computed(() => tasks.value.slice(page.value * PER_PAGE, (page.value + 1) * PER_PAGE));
const isToday = computed(() => data.value && data.value.date === data.value.today);
const done = computed(() => tasks.value.filter((t) => t.done).length);
const progress = computed(() => (tasks.value.length ? Math.round((done.value / tasks.value.length) * 100) : 0));
const logo = computed(() => (theme.value === 'dark' ? iconDark : iconLight));

function dayLabel(date, today) {
  if (date === today) return 'Hoy';
  if (date === addDays(today, 1)) return 'Mañana';
  if (date === addDays(today, -1)) return 'Ayer';
  return '';
}

function timeLabel(t) {
  if (t.date !== data.value.date) return { main: 'Continúa', sub: `desde el ${formatShort(t.date)}` };
  if (!t.startTime) return { main: 'Todo el día', sub: '' };
  return { main: t.startTime, sub: t.endTime ? `hasta ${t.endTime}` : '' };
}

async function load() {
  clearTimeout(refreshTimer);
  if (!token.value) {
    status.value = 'unauthorized';
    return;
  }
  const qs = viewDate.value ? `?date=${viewDate.value}` : '';
  const seq = ++requestSeq;
  try {
    const res = await fetch(`/api/display/day${qs}`, {
      headers: { Authorization: `Bearer ${token.value}` },
      cache: 'no-store',
    });
    if (seq !== requestSeq) return;
    if (res.status === 401) {
      status.value = 'unauthorized';
      return;
    }
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const json = await res.json();
    if (seq !== requestSeq) return;
    const changedDay = !data.value || data.value.date !== json.date;
    data.value = json;
    if (changedDay) page.value = 0;
    if (page.value >= pages.value) page.value = pages.value - 1;
    status.value = 'ok';
    errorMsg.value = '';
    lastOk.value = json.now;
    refreshTimer = setTimeout(load, REFRESH_MS);
  } catch (err) {
    if (seq !== requestSeq) return;
    // Se mantienen los datos anteriores con un aviso; se reintenta antes
    status.value = data.value ? 'ok' : 'error';
    errorMsg.value = err.message || 'Sin conexión con el servidor';
    refreshTimer = setTimeout(load, RETRY_MS);
  }
}

function goToDay(delta) {
  if (!data.value) return;
  // Se parte del día pedido (no del cargado): con varias pulsaciones seguidas la carga anterior
  // puede no haber terminado todavía
  const current = viewDate.value || data.value.today;
  const target = addDays(current, delta);
  viewDate.value = target === data.value.today ? null : target;
  page.value = 0;
  load();
}

function turnPage(delta) {
  page.value = (page.value + delta + pages.value) % pages.value;
  restartRotation();
}

function restartRotation() {
  clearInterval(rotateTimer);
  rotateTimer = setInterval(() => {
    if (pages.value > 1) page.value = (page.value + 1) % pages.value;
    // Sin tocar el mando un rato: volver a hoy
    if (viewDate.value && Date.now() - lastInputAt > IDLE_BACK_TO_TODAY_MS) {
      viewDate.value = null;
      load();
    }
  }, PAGE_ROTATE_MS);
}

function onKey(e) {
  const code = e.keyCode;
  if (![KEY.left, KEY.right, KEY.up, KEY.down, KEY.enter].includes(code)) return;
  e.preventDefault();
  lastInputAt = Date.now();
  if (code === KEY.left) goToDay(-1);
  else if (code === KEY.right) goToDay(1);
  else if (code === KEY.up) turnPage(-1);
  else turnPage(1);
}

function tickClock() {
  const d = new Date();
  clock.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

onMounted(() => {
  // El token llega una vez por la URL: se guarda en el televisor y se quita de la barra de direcciones
  const fromUrl = typeof route.query.token === 'string' ? route.query.token.trim() : '';
  if (fromUrl) {
    token.value = fromUrl;
    saveToken(fromUrl);
    router.replace({ name: 'tv' });
  }
  tickClock();
  clockTimer = setInterval(tickClock, 1000);
  window.addEventListener('keydown', onKey);
  restartRotation();
  load();
});

onBeforeUnmount(() => {
  clearTimeout(refreshTimer);
  clearInterval(rotateTimer);
  clearInterval(clockTimer);
  window.removeEventListener('keydown', onKey);
});

watch(pages, () => {
  if (page.value >= pages.value) page.value = 0;
});
</script>

<template>
  <main class="tv">
    <!-- Sin token o token revocado -->
    <section v-if="status === 'unauthorized'" class="message">
      <img class="message-logo" :src="logo" alt="Home Calendar" />
      <h1>Configura esta pantalla</h1>
      <ol>
        <li>En la web, entra como administrador → <strong>Administrar</strong> → <strong>Pantallas (ESP32 y TV)</strong>.</li>
        <li>Pulsa <strong>Generar token</strong> (por ejemplo, con el nombre "TV salón").</li>
        <li>Abre en este televisor la dirección <strong>/tv?token=…</strong> que aparece allí.</li>
      </ol>
      <p v-if="token" class="muted">El token guardado ya no es válido (¿se revocó?).</p>
    </section>

    <section v-else-if="status === 'error'" class="message">
      <img class="message-logo" :src="logo" alt="Home Calendar" />
      <h1>Sin conexión con el servidor</h1>
      <p class="muted">{{ errorMsg }} · reintentando…</p>
    </section>

    <section v-else-if="status === 'loading' || !data" class="message">
      <img class="message-logo" :src="logo" alt="Home Calendar" />
      <p class="muted">Cargando…</p>
    </section>

    <template v-else>
      <header class="head">
        <img class="logo" :src="logo" alt="Home Calendar" />
        <div class="day">
          <span class="day-label" :class="{ today: isToday }">{{ dayLabel(data.date, data.today) || 'Día' }}</span>
          <h1>{{ formatLong(data.date) }}</h1>
        </div>
        <div class="clock">{{ clock }}</div>
      </header>

      <div class="summary">
        <div class="bar"><span :style="{ width: `${progress}%` }" /></div>
        <span class="summary-text">
          <template v-if="tasks.length">
            <strong>{{ done }}</strong> de {{ tasks.length }} completadas
            <template v-if="data.pending"> · {{ data.pending }} pendientes</template>
          </template>
          <template v-else>Sin tareas</template>
        </span>
      </div>

      <section v-if="tasks.length" class="grid">
        <article
          v-for="t in visible"
          :key="`${t.id}-${t.date}`"
          class="card"
          :class="{ done: t.done }"
          :style="{ '--c': t.color }"
        >
          <span class="check" aria-hidden="true">{{ t.done ? '✓' : '' }}</span>
          <div class="time">
            <span class="time-main">{{ timeLabel(t).main }}</span>
            <span class="time-sub">{{ timeLabel(t).sub }}</span>
          </div>
          <div class="info">
            <h2 class="title">{{ t.title }}</h2>
            <div class="meta">
              <span v-if="categoriesById.get(t.categoryId)" class="category">
                {{ categoriesById.get(t.categoryId).icon }} {{ categoriesById.get(t.categoryId).name }}
              </span>
              <span class="duration">{{ formatDuration(t.durationValue, t.durationUnit) }}</span>
            </div>
            <div class="people">
              <span v-for="id in t.assignees" :key="id" class="person">
                <img v-if="membersById.get(id)" class="person-avatar" :src="membersById.get(id).avatar" alt="" />
                {{ membersById.get(id) ? membersById.get(id).name : 'Usuario' }}
              </span>
              <span v-if="!t.assignees.length" class="muted">Sin responsable</span>
            </div>
          </div>
        </article>
      </section>

      <section v-else class="empty">
        <span class="empty-check">✓</span>
        <p>{{ isToday ? 'No hay tareas para hoy' : 'No hay tareas este día' }}</p>
      </section>

      <footer class="foot">
        <span class="hint">◀ ▶ cambiar de día · ▲ ▼ / OK página</span>
        <span v-if="pages > 1" class="dots">
          <i v-for="n in pages" :key="n" :class="{ active: n - 1 === page }" />
        </span>
        <span class="updated" :class="{ alert: errorMsg }">
          {{ errorMsg ? `Sin conexión · últimos datos de las ${lastOk}` : `Actualizado ${lastOk}` }}
        </span>
      </footer>
    </template>
  </main>
</template>

<style scoped>
/*
 * Todo se mide en "em" sobre una base proporcional al ancho: a 1920 px, 1em = 20 px.
 * Así la misma vista se ve igual en un televisor 1080p/4K y en el navegador del ordenador.
 * Se evitan aspect-ratio, inset, dvh y otras propiedades que el navegador del televisor no tiene.
 */
.tv {
  font-size: 1.0417vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 2.2em 3em 1.6em;
  background: var(--color-bg);
  color: var(--color-text);
  box-sizing: border-box;
}

/* ---------- Cabecera ---------- */
.head {
  display: flex;
  align-items: center;
  gap: 1.4em;
}
.logo {
  width: 3.6em;
  height: 3.6em;
}
.day {
  flex: 1;
  min-width: 0;
}
.day-label {
  display: block;
  font-size: 1.1em;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.day-label.today {
  color: var(--color-accent);
}
.day h1 {
  font-size: 2.8em;
  font-weight: 800;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.clock {
  font-size: 3.6em;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

/* ---------- Progreso ---------- */
.summary {
  display: flex;
  align-items: center;
  gap: 1.2em;
  margin: 1.4em 0 1.2em;
}
.bar {
  flex: 1;
  height: 0.6em;
  border-radius: 1em;
  background: var(--color-surface);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  background: var(--color-success);
  transition: width 400ms ease;
}
.summary-text {
  font-size: 1.3em;
  color: var(--color-text-muted);
}
.summary-text strong {
  color: var(--color-text);
}

/* ---------- Tareas: 2 columnas x 3 filas ---------- */
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 1.1em;
}
.card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1.2em;
  min-width: 0;
  padding: 1em 1.4em 1em 1.8em;
  border-radius: 0.8em;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  overflow: hidden;
}
.card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0.5em;
  background: var(--c);
}
.check {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.4em;
  height: 2.4em;
  border-radius: 50%;
  border: 0.15em solid var(--color-text-faint);
  font-size: 1.2em;
  font-weight: 800;
}
.card.done .check {
  background: var(--color-success);
  border-color: var(--color-success);
  color: var(--color-bg);
}
.time {
  flex-shrink: 0;
  width: 7.5em;
  display: flex;
  flex-direction: column;
}
.time-main {
  font-size: 1.8em;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.time-sub {
  font-size: 1em;
  color: var(--color-text-muted);
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35em;
}
.title {
  font-size: 1.7em;
  font-weight: 700;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card.done .title {
  color: var(--color-text-faint);
  text-decoration: line-through;
}
.card.done .time-main {
  color: var(--color-text-faint);
}
.meta {
  display: flex;
  align-items: center;
  gap: 0.8em;
  font-size: 1.05em;
  color: var(--color-text-muted);
}
.category {
  padding: 0.15em 0.7em;
  border-radius: 1em;
  background: var(--color-surface);
  white-space: nowrap;
}
.people {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em 1em;
  font-size: 1.05em;
  color: var(--color-text-muted);
}
.person {
  display: flex;
  align-items: center;
  gap: 0.4em;
  white-space: nowrap;
}
.person-avatar {
  width: 1.6em;
  height: 1.6em;
  border-radius: 50%;
  object-fit: cover;
  background: var(--color-surface);
}

/* ---------- Sin tareas ---------- */
.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1em;
  font-size: 1.6em;
  color: var(--color-text-muted);
}
.empty-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3em;
  height: 3em;
  border-radius: 50%;
  background: var(--color-success);
  color: var(--color-bg);
  font-size: 2em;
  font-weight: 800;
}

/* ---------- Pie ---------- */
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1em;
  margin-top: 1.2em;
  font-size: 1.05em;
  color: var(--color-text-faint);
}
.dots {
  display: flex;
  gap: 0.6em;
}
.dots i {
  width: 0.7em;
  height: 0.7em;
  border-radius: 50%;
  background: var(--color-border);
}
.dots i.active {
  background: var(--color-text);
}
.updated.alert {
  color: var(--color-danger);
}

/* ---------- Mensajes (configuración, errores) ---------- */
.message {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2em;
  text-align: center;
  font-size: 1.4em;
}
.message-logo {
  width: 5em;
  height: 5em;
}
.message h1 {
  font-size: 2em;
}
.message ol {
  text-align: left;
  line-height: 1.8;
  color: var(--color-text-muted);
}
.message strong {
  color: var(--color-text);
}
.muted {
  color: var(--color-text-muted);
}
</style>
