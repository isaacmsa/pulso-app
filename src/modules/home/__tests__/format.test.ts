import { formatAgo, formatClock, formatDuration, formatStatus, weekdayLabel } from '../format';

// Hora de Caracas (UTC−4) como epoch ms.
const caracas = (day: number, hour: number, minute: number) =>
  Date.UTC(2026, 9, day, hour + 4, minute);

it('formatStatus da los tres textos de producto', () => {
  const now = caracas(23, 19, 25);
  expect(
    formatStatus(
      { state: 'con_luz', since: caracas(23, 14, 30), alias: 'Casa', openOutageStart: null },
      now,
    ),
  ).toBe('Hay luz desde las 2:30 p. m.');
  expect(
    formatStatus(
      {
        state: 'sin_luz',
        since: caracas(23, 18, 15),
        alias: 'Casa',
        openOutageStart: caracas(23, 18, 5),
      },
      now,
    ),
  ).toBe('Se fue la luz a las 6:05 p. m. (1 h 20 min)');
  expect(
    formatStatus(
      { state: 'sin_noticias', since: caracas(23, 19, 10), alias: 'Casa', openOutageStart: null },
      now,
    ),
  ).toBe('Sin noticias de la casa desde las 7:10 p. m.');
});

it('formatStatus sin_luz usa since si el servidor no manda el inicio del corte', () => {
  expect(
    formatStatus(
      { state: 'sin_luz', since: caracas(23, 18, 5), alias: 'Casa', openOutageStart: null },
      caracas(23, 19, 25),
    ),
  ).toBe('Se fue la luz a las 6:05 p. m. (1 h 20 min)');
});

it("formatDuration(4800000) es '1 h 20 min'", () => {
  expect(formatDuration(4_800_000)).toBe('1 h 20 min');
});

it('formatDuration cubre minutos, horas justas y menos de un minuto', () => {
  expect(formatDuration(45 * 60_000)).toBe('45 min');
  expect(formatDuration(2 * 3_600_000)).toBe('2 h');
  expect(formatDuration(30_000)).toBe('menos de 1 min');
  expect(formatDuration(0)).toBe('0 min');
  expect(formatDuration(26 * 3_600_000 + 5 * 60_000)).toBe('26 h 5 min');
});

it('formatClock usa 12 horas con a. m. y p. m. en hora de Caracas', () => {
  expect(formatClock(caracas(23, 0, 5))).toBe('12:05 a. m.');
  expect(formatClock(caracas(23, 12, 30))).toBe('12:30 p. m.');
  expect(formatClock(caracas(23, 9, 7))).toBe('9:07 a. m.');
});

it('formatAgo dice hace cuánto fue algo', () => {
  const now = caracas(23, 19, 0);
  expect(formatAgo(now - 20_000, now)).toBe('hace un momento');
  expect(formatAgo(now - 20 * 60_000, now)).toBe('hace 20 min');
  expect(formatAgo(now - 3 * 3_600_000, now)).toBe('hace 3 h');
  expect(formatAgo(now - 49 * 3_600_000, now)).toBe('hace 2 días');
});

it('weekdayLabel pone el día de la semana de una fecha de Caracas', () => {
  expect(weekdayLabel('2026-10-23')).toBe('vie 23 oct');
  expect(weekdayLabel('2026-10-19')).toBe('lun 19 oct');
});
