import { formatDuration } from './format';

const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const WEEKDAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function weekdayIndex(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** "lun" a partir de la fecha de Caracas "2026-10-19" que manda el servidor. */
export function weekdayShort(date: string): string {
  return WEEKDAYS_SHORT[weekdayIndex(date)] ?? '';
}

/** "Lunes" a partir de la fecha de Caracas "2026-10-19". */
export function weekdayFull(date: string): string {
  return WEEKDAYS_FULL[weekdayIndex(date)] ?? '';
}

/**
 * Altura de cada barra como fracción (0 a 1): el día con más horas llega a 1. Un día con algo de corte nunca baja de
 * `minVisible`, para que se vea; un día sin corte es 0.
 */
export function barHeights(values: number[], minVisible = 0.04): number[] {
  const max = Math.max(0, ...values);
  if (max === 0) return values.map(() => 0);
  return values.map((v) => (v > 0 ? Math.max(v / max, minVisible) : 0));
}

/**
 * La comparación con la semana pasada. Los totales los da el servidor (D-016). Se oculta (null) si la consulta de la
 * semana pasada falló o su total es 0: el 0 no distingue "sin cortes" de "sin cobertura" (D-039).
 */
export function compareWeeks(
  thisWeekMs: number,
  previousWeekMs: number | undefined,
): string | null {
  if (previousWeekMs === undefined || previousWeekMs <= 0) return null;
  const diff = thisWeekMs - previousWeekMs;
  if (diff === 0) return 'Igual que la semana pasada';
  return `${formatDuration(Math.abs(diff))} ${diff > 0 ? 'más' : 'menos'} que la semana pasada`;
}
