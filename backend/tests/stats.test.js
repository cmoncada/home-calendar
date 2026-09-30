import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, computeStats } from '../src/services/stats.js';

const occ = (date, { completed = false, assignees = [1], endDate = date } = {}) => ({
  date,
  endDate,
  completed,
  task: { assignees },
});

const users = [
  { id: 1, name: 'Ana' },
  { id: 2, name: 'Luis' },
];

test('clasifica completada, sin terminar y pendiente según hoy', () => {
  const today = '2026-09-15';
  assert.equal(classify(occ('2026-09-10', { completed: true }), today), 'completed');
  assert.equal(classify(occ('2026-09-10'), today), 'unfinished');
  assert.equal(classify(occ('2026-09-15'), today), 'pending');
  assert.equal(classify(occ('2026-09-20'), today), 'pending');
  // Una tarea de varios días que aún no termina sigue pendiente
  assert.equal(classify(occ('2026-09-13', { endDate: '2026-09-16' }), today), 'pending');
});

test('los totales cuadran y la tasa se calcula sobre lo vencido', () => {
  const list = [
    occ('2026-09-01', { completed: true }),
    occ('2026-09-02', { completed: true }),
    occ('2026-09-03'),
    occ('2026-09-20'),
  ];
  const { totals } = computeStats(list, { period: 'month', from: '2026-09-01', to: '2026-09-30', today: '2026-09-15', users });
  assert.deepEqual(totals, { generated: 4, completed: 2, unfinished: 1, pending: 1, completionRate: 67 });
  assert.equal(totals.completed + totals.unfinished + totals.pending, totals.generated);
});

test('serie anual de 12 meses y mensual con los días del mes', () => {
  const list = [occ('2026-02-10', { completed: true }), occ('2026-02-28'), occ('2026-11-01')];
  const year = computeStats(list, { period: 'year', from: '2026-01-01', to: '2026-12-31', today: '2026-12-31', users });
  assert.equal(year.series.length, 12);
  assert.equal(year.series[1].label, 'Feb');
  assert.equal(year.series[1].generated, 2);
  assert.equal(year.series[10].generated, 1);

  const feb = computeStats(list, { period: 'month', from: '2026-02-01', to: '2026-02-28', today: '2026-12-31', users });
  assert.equal(feb.series.length, 28);
  assert.equal(feb.series[9].completed, 1);
  assert.equal(feb.series[27].unfinished, 1);
});

test('ignora ocurrencias que empiezan fuera del periodo', () => {
  const list = [occ('2026-08-31', { endDate: '2026-09-02' }), occ('2026-09-01')];
  const { totals } = computeStats(list, { period: 'month', from: '2026-09-01', to: '2026-09-30', today: '2026-09-15', users });
  assert.equal(totals.generated, 1);
});

test('filtro por usuario y desglose con varios responsables y sin asignar', () => {
  const list = [
    occ('2026-09-01', { assignees: [1, 2], completed: true }),
    occ('2026-09-02', { assignees: [2] }),
    occ('2026-09-03', { assignees: [] }),
  ];
  const opts = { period: 'month', from: '2026-09-01', to: '2026-09-30', today: '2026-09-15', users };

  const all = computeStats(list, opts);
  assert.equal(all.totals.generated, 3);
  const byUser = Object.fromEntries(all.byUser.map((u) => [u.userId, u.generated]));
  assert.deepEqual(byUser, { 1: 1, 2: 2, null: 1 });

  const luis = computeStats(list, { ...opts, userId: 2 });
  assert.equal(luis.totals.generated, 2);
  assert.deepEqual(luis.byUser.map((u) => u.userId), [2]);
});

test('modo día agrupa por usuario', () => {
  const list = [
    occ('2026-09-10', { assignees: [1, 2], completed: true }),
    occ('2026-09-10', { assignees: [2] }),
  ];
  const { series } = computeStats(list, { period: 'day', from: '2026-09-10', to: '2026-09-10', today: '2026-09-15', users });
  assert.deepEqual(
    series.map((s) => [s.label, s.generated, s.completed, s.unfinished]),
    [
      ['Ana', 1, 1, 0],
      ['Luis', 2, 1, 1],
    ],
  );
});
