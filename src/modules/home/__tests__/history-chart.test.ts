import { barHeights, compareWeeks, weekdayFull, weekdayShort } from '../history-chart';

const HOUR = 3_600_000;

describe('barHeights', () => {
  it('el día con más horas es el 100% y los demás son proporcionales', () => {
    expect(barHeights([0, 2 * HOUR, HOUR, 4 * HOUR])).toEqual([0, 0.5, 0.25, 1]);
  });

  it('un día con algo de corte nunca queda invisible', () => {
    const [tiny, big] = barHeights([60_000, 10 * HOUR], 0.05);
    expect(tiny).toBe(0.05);
    expect(big).toBe(1);
  });

  it('una semana sin cortes da todo en cero', () => {
    expect(barHeights([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('compareWeeks', () => {
  it('dice más o menos con su diferencia', () => {
    expect(compareWeeks(3 * HOUR, HOUR + 50 * 60_000)).toBe('1 h 10 min más que la semana pasada');
    expect(compareWeeks(HOUR, 2 * HOUR)).toBe('1 h menos que la semana pasada');
  });

  it('igual si no cambió', () => {
    expect(compareWeeks(HOUR, HOUR)).toBe('Igual que la semana pasada');
  });

  it('sin datos de la semana pasada no hay comparación', () => {
    expect(compareWeeks(HOUR, undefined)).toBeNull();
    expect(compareWeeks(HOUR, 0)).toBeNull();
  });
});

it('nombres de día en hora de Caracas', () => {
  expect(weekdayShort('2026-10-19')).toBe('lun');
  expect(weekdayFull('2026-10-19')).toBe('Lunes');
  expect(weekdayFull('2026-10-18')).toBe('Domingo');
});
