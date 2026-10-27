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

describe('formatStatus con since de otro día (D-032)', () => {
  const now = caracas(23, 19, 25);
  const con = (since: number) => ({
    state: 'con_luz' as const,
    since,
    alias: 'Casa',
    openOutageStart: null,
  });
  const sinNoticias = (since: number) => ({ ...con(since), state: 'sin_noticias' as const });

  it('since de hoy da el texto exacto de producto', () => {
    expect(formatStatus(con(caracas(23, 14, 30)), now)).toBe('Hay luz desde las 2:30 p. m.');
    expect(formatStatus(sinNoticias(caracas(23, 19, 10)), now)).toBe(
      'Sin noticias de la casa desde las 7:10 p. m.',
    );
  });

  it('since de ayer dice ayer', () => {
    expect(formatStatus(con(caracas(22, 14, 30)), now)).toBe('Hay luz desde ayer a las 2:30 p. m.');
    expect(formatStatus(sinNoticias(caracas(22, 19, 10)), now)).toBe(
      'Sin noticias de la casa desde ayer a las 7:10 p. m.',
    );
    expect(
      formatStatus(
        { ...con(caracas(23, 0, 0)), state: 'sin_luz', openOutageStart: caracas(22, 23, 40) },
        caracas(23, 6, 0),
      ),
    ).toBe('Se fue la luz ayer a las 11:40 p. m. (6 h 20 min)');
  });

  it('since de hace 3 días dice la fecha', () => {
    expect(formatStatus(con(caracas(20, 14, 30)), now)).toBe(
      'Hay luz desde el 20/10 a las 2:30 p. m.',
    );
    expect(formatStatus(sinNoticias(caracas(20, 19, 10)), now)).toBe(
      'Sin noticias de la casa desde el 20/10 a las 7:10 p. m.',
    );
    expect(
      formatStatus(
        { ...con(caracas(20, 18, 0)), state: 'sin_luz', openOutageStart: caracas(20, 18, 5) },
        now,
      ),
    ).toBe('Se fue la luz el 20/10 a las 6:05 p. m. (73 h 20 min)');
  });

  it('cruza la medianoche de Caracas', () => {
    // 12:05 a. m. del 23 y el cambio fue a las 11:50 p. m. del 22: son 15 min, pero ya es "ayer".
    expect(formatStatus(con(caracas(22, 23, 50)), caracas(23, 0, 5))).toBe(
      'Hay luz desde ayer a las 11:50 p. m.',
    );
    // Un minuto antes de la medianoche sigue siendo hoy.
    expect(formatStatus(con(caracas(22, 23, 50)), caracas(22, 23, 59))).toBe(
      'Hay luz desde las 11:50 p. m.',
    );
  });
});
