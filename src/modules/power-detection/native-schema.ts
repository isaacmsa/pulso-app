import { z } from 'zod';

// Contrato puente Kotlin → JS. Mismos campos que `deviceEventSchema` de pulso-api/docs/api.md.
// En la fase 1 se reemplaza por el esquema generado desde openapi.json.

const epochMs = z.number().int().positive();

export const nativeSnapshotSchema = z.object({
  kind: z.literal('snapshot'),
  id: z.uuid(),
  at: epochMs,
  source: z.enum([
    'network_callback',
    'heartbeat',
    'charging_job',
    'power_receiver',
    'transition_check',
    'app_open',
    'boot',
  ]),
  plugged: z.boolean(),
  onWifi: z.boolean(),
  homeWifi: z.boolean().nullable(),
  internet: z.boolean().nullable(),
  interactive: z.boolean().nullable(),
  batteryPct: z.number().int().min(0).max(100).nullable(),
});

export const nativeReportSchema = z.object({
  kind: z.literal('report'),
  id: z.uuid(),
  at: epochMs,
  value: z.enum(['hay_luz', 'fluctuando', 'sin_luz']),
});

export const nativeConfirmationSchema = z.object({
  kind: z.literal('confirmation'),
  id: z.uuid(),
  at: epochMs,
  outageStart: epochMs,
  answer: z.boolean(),
});

export const nativeEventSchema = z.discriminatedUnion('kind', [
  nativeSnapshotSchema,
  nativeReportSchema,
  nativeConfirmationSchema,
]);

export type NativeSnapshot = z.infer<typeof nativeSnapshotSchema>;
export type NativeEvent = z.infer<typeof nativeEventSchema>;
