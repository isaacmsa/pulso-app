const CARACAS_OFFSET_MS = -4 * 60 * 60 * 1000; // UTC−4 fijo, sin horario de verano

/** "dd/mm hh:mm:ss" en hora de Caracas. */
export function formatCaracas(ms: number): string {
  const d = new Date(ms + CARACAS_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Medianoche de Caracas del día de `ms`, como epoch ms. */
export function startOfCaracasDay(ms: number): number {
  return Math.floor((ms + CARACAS_OFFSET_MS) / DAY_MS) * DAY_MS - CARACAS_OFFSET_MS;
}

/** Hora y fecha de Caracas de `ms`. `month` va de 1 a 12. */
export function caracasParts(ms: number) {
  const d = new Date(ms + CARACAS_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}
