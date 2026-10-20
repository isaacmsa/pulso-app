const CARACAS_OFFSET_MS = -4 * 60 * 60 * 1000; // UTC−4 fijo, sin horario de verano

/** "dd/mm hh:mm:ss" en hora de Caracas. */
export function formatCaracas(ms: number): string {
  const d = new Date(ms + CARACAS_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
