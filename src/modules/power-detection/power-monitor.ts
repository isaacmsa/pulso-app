import PowerMonitor from '../../../modules/power-monitor';
import {
  type NativeEvent,
  type NativeSnapshot,
  nativeEventSchema,
  nativeSnapshotSchema,
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
