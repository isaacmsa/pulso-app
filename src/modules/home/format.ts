import { ApiError } from '../../shared/api/client';
import type { HomeStatus } from '../../shared/api/generated/types.gen';
import { caracasParts, DAY_MS, startOfCaracasDay } from '../../shared/time/caracas';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** "1 h 20 min", "45 min", "2 h", "menos de 1 min". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / MINUTE_MS);
  if (totalMinutes === 0) return ms > 0 ? 'menos de 1 min' : '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** "6:05 p. m." en hora de Caracas. */
export function formatClock(ms: number): string {
  const { hour, minute } = caracasParts(ms);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'a. m.' : 'p. m.'}`;
}

/** "hace un momento", "hace 20 min", "hace 3 h", "hace 2 días". */
export function formatAgo(ms: number, now: number): string {
  const elapsed = Math.max(0, now - ms);
  if (elapsed < MINUTE_MS) return 'hace un momento';
  if (elapsed < HOUR_MS) return `hace ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `hace ${Math.floor(elapsed / HOUR_MS)} h`;
  const days = Math.floor(elapsed / DAY_MS);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}

/** null si `ms` es de hoy en Caracas; si no, "ayer" o "el 12/11". */
function dayLabel(ms: number, now: number): string | null {
  const days = Math.round((startOfCaracasDay(now) - startOfCaracasDay(ms)) / DAY_MS);
  if (days <= 0) return null;
  return days === 1 ? 'ayer' : formatDate(ms);
}

/** "a las 2:30 p. m." si es de hoy; si no, "ayer a las 2:30 p. m." o "el 12/11 a las 2:30 p. m.". */
function formatAt(ms: number, now: number): string {
  const day = dayLabel(ms, now);
  return `${day ? `${day} ` : ''}a las ${formatClock(ms)}`;
}

/**
 * Lo que va después de "desde": "las 2:30 p. m.", "ayer a las 2:30 p. m." o "el 12/11 a las 2:30 p. m.". Lo usan el
 * estado de la casa y el del teléfono, para que la misma pantalla diga "ayer" igual en los dos (D-032).
 */
function formatSince(ms: number, now: number): string {
  return dayLabel(ms, now) ? formatAt(ms, now) : `las ${formatClock(ms)}`;
}

/** "el 12/11" (día/mes) en hora de Caracas. */
function formatDate(ms: number): string {
  const { day, month } = caracasParts(ms);
  return `el ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

/**
 * El estado de la casa en una frase (textos de docs/product.md). Si la hora no es de hoy en Caracas, dice "ayer" o la
 * fecha (D-032). La app no clasifica: solo muestra lo que dio el servidor (D-016).
 */
export function formatStatus(status: HomeStatus, now: number): string {
  switch (status.state) {
    case 'con_luz':
      return `Hay luz desde ${formatSince(status.since, now)}`;
    case 'sin_luz': {
      const start = status.openOutageStart ?? status.since;
      return `Se fue la luz ${formatAt(start, now)} (${formatDuration(now - start)})`;
    }
    case 'sin_noticias':
      return `Sin noticias de la casa desde ${formatSince(status.since, now)}`;
  }
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "vie 23 oct" a partir de la fecha de Caracas "2026-10-23" que manda el servidor. */
export function weekdayLabel(date: string): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]}`;
}

/** Los 7 días de Caracas que terminan hoy: de la medianoche de hace 6 días a la del día siguiente. */
export function weekRange(now: number): { from: number; to: number } {
  const today = startOfCaracasDay(now);
  return { from: today - 6 * DAY_MS, to: today + DAY_MS };
}

/** Lo que dice el teléfono: desde cuándo está (o no) en corriente. `since` es el primer snapshot de la racha. */
export function formatPhoneState(plugged: boolean, since: number, now: number): string {
  return `${plugged ? 'Con corriente' : 'Sin corriente'} desde ${formatSince(since, now)}`;
}

/** Texto para una falla al pedir datos al servidor. */
export function describeError(error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'unknown';
  switch (code) {
    case 'network':
    case 'timeout':
      return 'Sin conexión con el servidor. Revisa tu internet.';
    case 'invalid_response':
      return 'El servidor respondió algo que esta versión no entiende. Actualiza la app.';
    case 'invalid_token':
      return 'El servidor no reconoce este teléfono.';
    case 'not_found':
      return 'El servidor no tiene una casa para este teléfono.';
    case 'rate_limited':
      return 'Demasiados intentos. Espera un momento y reintenta.';
    default:
      return 'No se pudo cargar. Intenta de nuevo.';
  }
}
