import * as Sharing from 'expo-sharing';
import { z } from 'zod';
import PowerMonitor from '../../../modules/power-monitor';
import type { HomeStatus } from '../../shared/api/generated/types.gen';
import { zHomeStatus } from '../../shared/api/generated/zod.gen';
import {
  type NativeDiagnostics,
  type NativeEvent,
  type NativeSnapshot,
  nativeDiagnosticsSchema,
  nativeEventSchema,
  nativeSnapshotSchema,
  type ReportValue,
} from './native-schema';

export class PowerMonitorError extends Error {
  constructor(
    readonly code: 'bad_json' | 'invalid_event',
    message: string,
  ) {
    super(message);
    this.name = 'PowerMonitorError';
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new PowerMonitorError('bad_json', 'El módulo nativo devolvió algo que no es JSON');
  }
}

/** Eventos guardados en el teléfono desde `sinceMs`. Los que no cumplen el contrato se cuentan aparte. */
export async function readEvents(
  sinceMs: number,
): Promise<{ events: NativeEvent[]; invalid: number }> {
  const raw = parseJson(await PowerMonitor.getEvents(sinceMs));
  const items = Array.isArray(raw) ? raw : [];
  const events: NativeEvent[] = [];
  let invalid = Array.isArray(raw) ? 0 : 1;
  for (const item of items) {
    const parsed = nativeEventSchema.safeParse(item);
    if (parsed.success) events.push(parsed.data);
    else invalid += 1;
  }
  return { events, invalid };
}

const phoneStateSchema = z.object({ snapshot: nativeSnapshotSchema, since: z.int().positive() });

export type PhoneState = { plugged: boolean; since: number };

/**
 * El estado crudo del teléfono: si está en corriente y desde cuándo, sin tocar al servidor. `since` es el primer
 * snapshot de la racha actual. Lo calcula el nativo sobre todos los snapshots guardados (14 días), no sobre los
 * últimos 500 eventos de `readEvents`, que el relevo de C y el latido llenan en unos 2 días. null si no hay snapshots.
 */
export async function readPhoneState(): Promise<PhoneState | null> {
  const raw = await PowerMonitor.getPhoneStateSince();
  if (raw == null) return null;
  const parsed = phoneStateSchema.safeParse(parseJson(raw));
  if (!parsed.success) {
    throw new PowerMonitorError('invalid_event', 'El estado del teléfono no cumple el contrato');
  }
  return { plugged: parsed.data.snapshot.plugged, since: parsed.data.since };
}

/** Toma un snapshot ahora (fuente `app_open`) y lo devuelve validado. */
export async function recordAppOpen(): Promise<NativeSnapshot> {
  const parsed = nativeSnapshotSchema.safeParse(
    parseJson(await PowerMonitor.recordSnapshot('app_open')),
  );
  if (!parsed.success) {
    throw new PowerMonitorError('invalid_event', 'El snapshot nativo no cumple el contrato');
  }
  return parsed.data;
}

/** Arma los mecanismos de detección en el nativo. Es idempotente. */
export function arm(): Promise<void> {
  return PowerMonitor.arm();
}

/** Si el usuario dejó encendido el servicio en primer plano. */
export function isForegroundServiceEnabled(): Promise<boolean> {
  return PowerMonitor.isForegroundServiceEnabled();
}

/** Activa o apaga el servicio en primer plano (mecanismo D, experimental). */
export function setForegroundServiceEnabled(enabled: boolean): Promise<void> {
  return PowerMonitor.setForegroundServiceEnabled(enabled);
}

/** Guarda un reporte manual: los botones "Se fue la luz ahora", "Volvió" y "Fluctuando". */
export async function recordReport(value: ReportValue): Promise<void> {
  await PowerMonitor.recordReport(value);
}

/** Toma la red Wi-Fi actual como la de casa. */
export function learnHomeNetwork(): Promise<boolean> {
  return PowerMonitor.learnHomeNetwork();
}

export async function readDiagnostics(): Promise<NativeDiagnostics> {
  const parsed = nativeDiagnosticsSchema.safeParse(parseJson(await PowerMonitor.getDiagnostics()));
  if (!parsed.success) {
    throw new PowerMonitorError('invalid_event', 'El diagnóstico nativo no cumple el contrato');
  }
  return parsed.data;
}

/** Escribe el exporte y abre el menú de compartir (para mandarlo por WhatsApp). */
export async function exportAndShare(): Promise<void> {
  const uri = await PowerMonitor.exportEvents();
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Exporte de Pulso' });
}

/** Entrega el token a la bóveda nativa en el momento del registro. JS nunca lo guarda (regla 3). */
export function storeToken(token: string): Promise<void> {
  return PowerMonitor.storeToken(token);
}

/** Token del dispositivo, o null si no hay (o si el Keystore no pudo leerlo). */
export function getToken(): Promise<string | null> {
  return PowerMonitor.getToken();
}

/** Si el servidor rechazó el token y hay que registrar de nuevo. */
export function isTokenInvalid(): Promise<boolean> {
  return PowerMonitor.isTokenInvalid();
}

/** Le dice al nativo dónde está la API, para la subida en segundo plano. */
export function configureApi(apiUrl: string): Promise<void> {
  return PowerMonitor.configureApi(apiUrl);
}

const lastServerStatusSchema = z.object({
  status: zHomeStatus,
  receivedAt: z.int().positive(),
});

export type LastServerStatus = { status: HomeStatus; receivedAt: number };

/**
 * El último estado de la casa que dio el servidor a la subida en segundo plano, con la hora (epoch ms) en que
 * llegó (D-016, D-027). null si no hay, si lo guardado no cumple `zHomeStatus` o si viene del formato viejo
 * sin `receivedAt`.
 */
export async function getLastServerStatus(): Promise<LastServerStatus | null> {
  const raw = await PowerMonitor.getLastServerStatus();
  if (raw == null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = lastServerStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type Role = 'watch' | 'follow';

/** Guarda en el nativo lo que eligió la persona. Un teléfono `follow` nunca arma ni sube (Kotlin lo respeta solo). */
export function setRole(role: Role): Promise<void> {
  return PowerMonitor.setRole(role);
}

/** El rol guardado, o null si todavía no eligió (o si lo guardado no es uno de los dos). */
export async function getRole(): Promise<Role | null> {
  const role = await PowerMonitor.getRole();
  return role === 'watch' || role === 'follow' ? role : null;
}

/** Sube ya lo pendiente, sin esperar al próximo latido. No hace nada en un teléfono `follow`. */
export function requestUpload(): Promise<void> {
  return PowerMonitor.requestUpload();
}

export type BatterySettingsKind = 'autostart' | 'battery';

/** Abre la pantalla del fabricante para ese ajuste (o los detalles de la app). Devuelve si se abrió alguna. */
export function openBatterySettings(kind: BatterySettingsKind): Promise<boolean> {
  return PowerMonitor.openBatterySettings(kind);
}

export type OnboardingStep = 'role' | 'notifications' | 'battery' | 'home';

const ONBOARDING_STEPS: readonly string[] = ['role', 'notifications', 'battery', 'home'];

/** Anota en el nativo qué paso del onboarding falta; `null` lo da por terminado. */
export function setOnboardingStep(step: OnboardingStep | null): Promise<void> {
  return PowerMonitor.setOnboardingStep(step);
}

/** El paso pendiente, o null si no hay (terminado, o un teléfono registrado antes de esta marca). */
export async function getOnboardingStep(): Promise<OnboardingStep | null> {
  const step = await PowerMonitor.getOnboardingStep();
  return step !== null && ONBOARDING_STEPS.includes(step) ? (step as OnboardingStep) : null;
}

/**
 * Borra todo lo que el teléfono guarda de la persona y cancela los trabajos. Llamarlo solo después de que el servidor
 * confirmó el borrado (204): hasta entonces, nada local se toca. Lanza si el nativo no pudo con algún paso.
 */
export function wipe(): Promise<void> {
  return PowerMonitor.wipe();
}
