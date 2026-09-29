import { z } from 'zod';
import { isDateString } from './services/dates.js';

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(40, 'El nombre no puede superar 40 caracteres');

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar 72 caracteres');

export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido');

export const dateSchema = z.string().refine(isDateString, 'Fecha inválida (YYYY-MM-DD)');

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)');

export const idParam = z.coerce.number().int().positive();

export const taskSchema = z
  .object({
    title: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
    notes: z.string().trim().max(2000).nullish().transform((v) => v || null),
    color: colorSchema.default('#e50914'),
    startDate: dateSchema,
    startTime: timeSchema.nullish().transform((v) => v || null),
    durationValue: z.coerce.number().int().min(1, 'La duración mínima es 1'),
    durationUnit: z.enum(['hours', 'days']),
    recurrenceType: z.enum(['none', 'weekly', 'monthly']).default('none'),
    recurrenceDays: z.array(z.number().int()).default([]),
    recurrenceUntil: dateSchema.nullish().transform((v) => v || null),
    assignees: z.array(z.number().int().positive()).default([]),
  })
  .superRefine((t, ctx) => {
    const max = t.durationUnit === 'hours' ? 168 : 365;
    if (t.durationValue > max) {
      ctx.addIssue({ code: 'custom', path: ['durationValue'], message: `Máximo ${max} ${t.durationUnit === 'hours' ? 'horas' : 'días'}` });
    }
    if (t.recurrenceType === 'weekly' && (!t.recurrenceDays.length || t.recurrenceDays.some((d) => d < 0 || d > 6))) {
      ctx.addIssue({ code: 'custom', path: ['recurrenceDays'], message: 'Elige al menos un día de la semana' });
    }
    if (t.recurrenceType === 'monthly' && (!t.recurrenceDays.length || t.recurrenceDays.some((d) => d < 1 || d > 31))) {
      ctx.addIssue({ code: 'custom', path: ['recurrenceDays'], message: 'Elige al menos un día del mes' });
    }
    if (t.recurrenceUntil && t.recurrenceUntil < t.startDate) {
      ctx.addIssue({ code: 'custom', path: ['recurrenceUntil'], message: 'La fecha fin debe ser posterior al inicio' });
    }
  })
  .transform((t) => ({
    ...t,
    recurrenceDays: t.recurrenceType === 'none' ? [] : [...new Set(t.recurrenceDays)].sort((a, b) => a - b),
    recurrenceUntil: t.recurrenceType === 'none' ? null : t.recurrenceUntil,
  }));

export const rangeSchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine((r) => r.from <= r.to, 'El rango es inválido');
