<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api/client.js';
import { addDays, addMonths, formatLong, formatMonthYear, today } from '../utils/dates.js';
import StatsBarChart from '../components/StatsBarChart.vue';

const route = useRoute();
const router = useRouter();

const PERIODS = [
  { value: 'year', label: 'Año' },
  { value: 'month', label: 'Mes' },
  { value: 'day', label: 'Día' },
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// El estado de los filtros vive en la URL para poder recargar o compartir
const period = computed(() => (PERIODS.some((p) => p.value === route.query.period) ? route.query.period : 'month'));
const date = computed(() => (DATE_RE.test(route.query.date ?? '') ? route.query.date : today()));
const userId = computed(() => (route.query.userId ? Number(route.query.userId) : null));

const data = ref(null);
const loading = ref(false);
const error = ref('');

function setQuery(patch) {
  const next = { period: period.value, date: date.value, ...patch };
  if (next.userId === undefined && userId.value) next.userId = userId.value;
  if (!next.userId) delete next.userId;
  router.replace({ query: next });
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const qs = new URLSearchParams({ period: period.value, date: date.value });
    if (userId.value) qs.set('userId', userId.value);
    data.value = await api.get(`/admin/stats?${qs}`);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
watch([period, date, userId], load, { immediate: true });

function move(step) {
  if (period.value === 'year') setQuery({ date: `${Number(date.value.slice(0, 4)) + step}-01-01` });
  else if (period.value === 'month') setQuery({ date: addMonths(date.value, step) });
  else setQuery({ date: addDays(date.value, step) });
}

const title = computed(() => {
  if (period.value === 'year') return date.value.slice(0, 4);
  if (period.value === 'month') return formatMonthYear(date.value);
  return formatLong(date.value);
});

const years = computed(() => {
  const now = Number(today().slice(0, 4));
  const first = Math.min(data.value?.firstYear ?? now, Number(date.value.slice(0, 4)));
  return Array.from({ length: now + 1 - first + 1 }, (_, i) => first + i);
});

const members = computed(() => data.value?.users ?? []);
const usersById = computed(() => new Map(members.value.map((u) => [u.id, u])));

const kpis = computed(() => {
  const t = data.value?.totals;
  if (!t) return [];
  return [
    { key: 'generated', label: 'Generadas', value: t.generated },
    { key: 'completed', label: 'Completadas', value: t.completed },
    { key: 'unfinished', label: 'Sin terminar', value: t.unfinished },
    { key: 'pending', label: 'Pendientes', value: t.pending },
    { key: 'rate', label: 'Cumplimiento', value: t.completionRate === null ? '—' : `${t.completionRate}%` },
  ];
});

const empty = computed(() => data.value && data.value.totals.generated === 0);

/** Drill-down: año → mes → día */
function drill(key) {
  if (period.value === 'year') setQuery({ period: 'month', date: `${key}-01` });
  else if (period.value === 'month') setQuery({ period: 'day', date: key });
}

function rowUser(row) {
  return row.userId === null ? { name: 'Sin asignar', avatar: null } : usersById.value.get(row.userId) ?? { name: 'Usuario eliminado' };
}
</script>

<template>
  <main class="page dashboard">
    <div class="head">
      <h1>Dashboard</h1>
      <RouterLink to="/admin" class="btn btn-ghost">Administrar usuarios</RouterLink>
    </div>

    <section class="filters card">
      <div class="segmented" role="radiogroup" aria-label="Periodo">
        <button
          v-for="p in PERIODS"
          :key="p.value"
          type="button"
          role="radio"
          :aria-checked="period === p.value"
          :class="{ active: period === p.value }"
          @click="setQuery({ period: p.value })"
        >
          {{ p.label }}
        </button>
      </div>

      <div class="nav">
        <button class="btn btn-ghost btn-icon" type="button" aria-label="Anterior" @click="move(-1)">‹</button>
        <select
          v-if="period === 'year'"
          class="input picker"
          :value="date.slice(0, 4)"
          aria-label="Año"
          @change="setQuery({ date: `${$event.target.value}-01-01` })"
        >
          <option v-for="y in years" :key="y" :value="String(y)">{{ y }}</option>
        </select>
        <input
          v-else-if="period === 'month'"
          class="input picker"
          type="month"
          :value="date.slice(0, 7)"
          aria-label="Mes"
          @change="$event.target.value && setQuery({ date: `${$event.target.value}-01` })"
        />
        <input
          v-else
          class="input picker"
          type="date"
          :value="date"
          aria-label="Día"
          @change="$event.target.value && setQuery({ date: $event.target.value })"
        />
        <button class="btn btn-ghost btn-icon" type="button" aria-label="Siguiente" @click="move(1)">›</button>
        <button class="btn btn-ghost" type="button" @click="setQuery({ date: today() })">Hoy</button>
      </div>

      <select
        class="input user"
        :value="userId ?? ''"
        aria-label="Usuario"
        @change="setQuery({ userId: Number($event.target.value) || null })"
      >
        <option value="">Todos los usuarios</option>
        <option v-for="u in members" :key="u.id" :value="u.id">{{ u.name }}</option>
      </select>
    </section>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <template v-if="data">
      <h2 class="period-title">
        {{ title }}
        <span v-if="userId" class="muted"> · {{ usersById.get(userId)?.name }}</span>
      </h2>

      <section class="kpis" :class="{ loading }">
        <article v-for="k in kpis" :key="k.key" class="kpi" :class="k.key">
          <span class="kpi-label">{{ k.label }}</span>
          <strong class="kpi-value">{{ k.value }}</strong>
        </article>
      </section>

      <section class="card chart-card" :class="{ loading }">
        <div class="chart-head">
          <h3>
            {{ period === 'year' ? 'Tareas por mes' : period === 'month' ? 'Tareas por día' : 'Tareas por usuario' }}
          </h3>
          <span v-if="period !== 'day'" class="muted small">Haz clic en una barra para ver el detalle</span>
        </div>
        <p v-if="empty" class="empty muted">No hay tareas en este periodo.</p>
        <StatsBarChart v-else :series="data.series" :clickable="period !== 'day'" @select="drill" />
      </section>

      <section class="card" :class="{ loading }">
        <h3>Por usuario</h3>
        <p v-if="!data.byUser.length" class="muted small">Sin datos.</p>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th class="num">Generadas</th>
                <th class="num">Completadas</th>
                <th class="num">Sin terminar</th>
                <th class="num">Pendientes</th>
                <th>Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.byUser" :key="row.userId ?? 'none'">
                <td>
                  <button
                    v-if="row.userId !== null"
                    type="button"
                    class="who"
                    :title="`Filtrar por ${rowUser(row).name}`"
                    @click="setQuery({ userId: row.userId })"
                  >
                    <img v-if="rowUser(row).avatar" class="avatar" :src="rowUser(row).avatar" alt="" />
                    {{ rowUser(row).name }}
                  </button>
                  <span v-else class="who muted">{{ rowUser(row).name }}</span>
                </td>
                <td class="num">{{ row.generated }}</td>
                <td class="num ok">{{ row.completed }}</td>
                <td class="num bad">{{ row.unfinished }}</td>
                <td class="num">{{ row.pending }}</td>
                <td>
                  <div class="rate">
                    <div class="rate-bar"><span :style="{ width: `${row.completionRate ?? 0}%` }" /></div>
                    <span class="small">{{ row.completionRate === null ? '—' : `${row.completionRate}%` }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="muted small note">
        "Sin terminar" son tareas de días ya pasados que no se marcaron como hechas; "Pendientes" son las de hoy o
        futuras. El cumplimiento se calcula sobre las ya vencidas. Las tareas privadas se cuentan pero no se muestran.
      </p>
    </template>
  </main>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.dashboard > * {
  min-width: 0;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}
h1 {
  font-size: var(--fs-xl);
}
h3 {
  font-size: var(--fs-md);
  margin-bottom: var(--space-3);
}
.small {
  font-size: var(--fs-sm);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}
.segmented {
  display: inline-flex;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.segmented button {
  padding: 0 var(--space-4);
  border: 0;
  background: transparent;
  font-size: var(--fs-sm);
  cursor: pointer;
}
.segmented button + button {
  border-left: 1px solid var(--color-border);
}
.segmented button.active {
  background: var(--color-text);
  color: var(--color-bg);
  font-weight: 700;
}
.nav {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.btn-icon {
  font-size: 1.4rem;
}
.picker {
  width: auto;
  min-height: 40px;
}
.user {
  width: auto;
  min-height: 40px;
  margin-left: auto;
}
.period-title {
  font-size: var(--fs-lg);
}
.kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-3);
}
.kpi {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-top: 3px solid var(--kpi, var(--color-text-muted));
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}
.kpi.generated {
  --kpi: var(--color-text);
}
.kpi.completed {
  --kpi: var(--chart-completed);
}
.kpi.unfinished {
  --kpi: var(--chart-unfinished);
}
.kpi.pending {
  --kpi: var(--chart-pending);
}
.kpi.rate {
  --kpi: var(--color-accent);
}
.kpi-label {
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}
.kpi-value {
  font-size: 2rem;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.loading {
  opacity: 0.55;
  transition: opacity var(--transition);
}
.chart-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.empty {
  padding: var(--space-7) 0;
  text-align: center;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
th,
td {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}
th {
  font-size: var(--fs-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ok {
  color: var(--chart-completed);
}
.bad {
  color: var(--chart-unfinished);
}
.who {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}
button.who:hover {
  text-decoration: underline;
}
.who .avatar {
  width: 26px;
}
.rate {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 140px;
}
.rate-bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--color-surface-hover);
  overflow: hidden;
}
.rate-bar span {
  display: block;
  height: 100%;
  background: var(--chart-completed);
}
.note {
  max-width: 760px;
}
@media (max-width: 900px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .kpi.rate {
    grid-column: 1 / -1;
  }
}
@media (max-width: 600px) {
  .filters {
    padding: var(--space-3);
  }
  .segmented {
    width: 100%;
  }
  .segmented button {
    flex: 1;
  }
  .nav {
    width: 100%;
  }
  .picker {
    flex: 1;
  }
  .user {
    width: 100%;
    margin-left: 0;
  }
  .kpi-value {
    font-size: 1.6rem;
  }
}
</style>
