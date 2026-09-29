import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandOccurrences, spanDays } from '../src/services/recurrence.js';

const base = {
  id: 1,
  start_date: '2026-09-01',
  start_time: null,
  duration_value: 1,
  duration_unit: 'hours',
  recurrence_type: 'none',
  recurrence_days: null,
  recurrence_until: null,
};

const dates = (occ) => occ.map((o) => o.date);

test('tarea única aparece solo en su fecha', () => {
  assert.deepEqual(dates(expandOccurrences(base, '2026-09-01', '2026-09-30')), ['2026-09-01']);
  assert.deepEqual(expandOccurrences(base, '2026-09-02', '2026-09-30'), []);
});

test('semanal lunes, miércoles y viernes', () => {
  const task = { ...base, recurrence_type: 'weekly', recurrence_days: [1, 3, 5] };
  // 2026-09-01 es martes
  assert.deepEqual(dates(expandOccurrences(task, '2026-09-01', '2026-09-07')), [
    '2026-09-02',
    '2026-09-04',
    '2026-09-07',
  ]);
});

test('semanal respeta la fecha de inicio y la fecha fin', () => {
  const task = { ...base, start_date: '2026-09-10', recurrence_type: 'weekly', recurrence_days: [4], recurrence_until: '2026-09-24' };
  assert.deepEqual(dates(expandOccurrences(task, '2026-09-01', '2026-10-31')), ['2026-09-10', '2026-09-17', '2026-09-24']);
});

test('mensual día 31 cae en el último día de meses cortos', () => {
  const task = { ...base, start_date: '2026-01-01', recurrence_type: 'monthly', recurrence_days: [31] };
  assert.deepEqual(dates(expandOccurrences(task, '2026-01-01', '2026-04-30')), [
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
  ]);
});

test('mensual varios días sin duplicados', () => {
  const task = { ...base, start_date: '2026-02-01', recurrence_type: 'monthly', recurrence_days: [1, 15, 30, 31] };
  assert.deepEqual(dates(expandOccurrences(task, '2026-02-01', '2026-02-28')), ['2026-02-01', '2026-02-15', '2026-02-28']);
});

test('tarea de varios días se incluye si empieza antes del rango', () => {
  const task = { ...base, start_date: '2026-09-28', duration_value: 3, duration_unit: 'days' };
  const occ = expandOccurrences(task, '2026-09-30', '2026-10-05');
  assert.equal(occ.length, 1);
  assert.equal(occ[0].date, '2026-09-28');
  assert.equal(occ[0].endDate, '2026-09-30');
});

test('horas que cruzan medianoche ocupan dos días', () => {
  const task = { ...base, start_time: '22:00:00', duration_value: 3 };
  assert.equal(spanDays(task), 2);
  const [occ] = expandOccurrences(task, '2026-09-01', '2026-09-01');
  assert.equal(occ.startTime, '22:00');
  assert.equal(occ.endTime, '01:00');
  assert.equal(occ.endDate, '2026-09-02');
});

test('excepciones eliminan ocurrencias concretas', () => {
  const task = { ...base, recurrence_type: 'weekly', recurrence_days: [2] };
  const occ = expandOccurrences(task, '2026-09-01', '2026-09-30', new Set(['2026-09-08']));
  assert.deepEqual(dates(occ), ['2026-09-01', '2026-09-15', '2026-09-22', '2026-09-29']);
});
