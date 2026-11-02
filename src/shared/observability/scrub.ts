// Filtros de privacidad para Sentry (AGENTS.md regla 3, docs/security-privacy.md). Módulo puro: sin Sentry ni React.
// Borra el token del dispositivo, el push token, el deviceId, la cabecera Authorization, el código de casa y su alias.

const REDACTED = '[borrado]';
const MAX_DEPTH = 12;

// Token del dispositivo: <43 base64url>.<43 base64url>.
const DEVICE_TOKEN = /[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}/g;
// Push token de Expo (también la variante antigua ExpoPushToken).
const PUSH_TOKEN = /Expo(?:nent)?PushToken\[[^\]]*\]/g;
// Código de casa en /c/CODE (se conserva el prefijo).
const HOUSE_CODE = /(\/c\/)[^/\s?#"'&]+/g;

export function scrubString(value: string): string {
  return value
    .replace(PUSH_TOKEN, '[push-token]')
    .replace(DEVICE_TOKEN, '[token]')
    .replace(HOUSE_CODE, '$1[codigo]');
}

// Claves exactas (en minúsculas, sin guiones): el código de casa (`code`, `shareCode`) da acceso a seguirla, y el
// alias suele ser un nombre de persona ("Casa de mamá").
const SENSITIVE_KEYS = new Set([
  'authorization',
  'deviceid',
  'cookie',
  'code',
  'sharecode',
  'alias',
]);

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_]/g, '');
  return k.includes('token') || SENSITIVE_KEYS.has(k);
}

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? REDACTED : scrubValue(inner, depth + 1);
  }
  return out;
}

/** Copia profunda del evento (o breadcrumb) con todo lo sensible borrado: petición, extra, contextos, mensajes, etc. */
function scrub<T>(input: T): T {
  return scrubValue(input, 0) as T;
}

export const scrubEvent = scrub;
export const scrubBreadcrumb = scrub;
