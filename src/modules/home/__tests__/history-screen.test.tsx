import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { createTestQueryClient } from '../../../shared/query/test-client';
import * as native from '../../power-detection/power-monitor';
import History from '../screens/HistoryScreen';

jest.mock('../../power-detection/power-monitor', () => ({ getRole: jest.fn() }));

const mocked = native as jest.Mocked<typeof native>;

// Viernes 23 de octubre de 2026, 6:30 p. m. en Caracas.
const NOW = Date.UTC(2026, 9, 23, 22, 30);
const HOUR = 3_600_000;

const WEEK = [
  { date: '2026-10-17', ms: 0 },
  { date: '2026-10-18', ms: 2 * HOUR },
  { date: '2026-10-19', ms: 0 },
  { date: '2026-10-20', ms: HOUR + 20 * 60_000 },
  { date: '2026-10-21', ms: 0 },
  { date: '2026-10-22', ms: 30 * 60_000 },
  { date: '2026-10-23', ms: 0 },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderWithQuery(ui: ReactElement) {
  const client = createTestQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mocked.getRole.mockResolvedValue('watch');
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('Historial suma la semana', async () => {
  const fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      json({ items: [], reports: [], totalMs: 3 * HOUR + 50 * 60_000, days: WEEK }),
    );
  await renderWithQuery(<History />);
  expect(await screen.findByText('3 h 50 min')).toBeOnTheScreen();
  expect(screen.getByText('Total de la semana')).toBeOnTheScreen();
  expect(screen.getByText('dom 18 oct')).toBeOnTheScreen();
  expect(screen.getByText('2 h')).toBeOnTheScreen();
  expect(screen.getByText('1 h 20 min')).toBeOnTheScreen();
  expect(screen.getByText('vie 23 oct')).toBeOnTheScreen();

  // Pide los 7 días de Caracas que terminan hoy: de la medianoche del 17 a la del 24.
  const request = fetchSpy.mock.calls[0]?.[0] as Request;
  const url = new URL(request.url);
  expect(url.pathname).toBe('/v1/homes/me/outages');
  expect(Number(url.searchParams.get('from'))).toBe(Date.UTC(2026, 9, 17, 4, 0));
  expect(Number(url.searchParams.get('to'))).toBe(Date.UTC(2026, 9, 24, 4, 0));
});

it('Historial sin cortes en la semana lo dice', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      json({ items: [], reports: [], totalMs: 0, days: WEEK.map((d) => ({ ...d, ms: 0 })) }),
    );
  await renderWithQuery(<History />);
  expect(await screen.findByText('Sin cortes esta semana')).toBeOnTheScreen();
});

it('Historial sin red avisa y ofrece reintentar', async () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
  await renderWithQuery(<History />);
  expect(
    await screen.findByText('Sin conexión con el servidor. Revisa tu internet.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Reintentar')).toBeOnTheScreen();
});

it('un teléfono que solo sigue casas no pide nada y lo dice', async () => {
  mocked.getRole.mockResolvedValue('follow');
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  await renderWithQuery(<History />);
  expect(await screen.findByText('Este teléfono solo sigue casas')).toBeOnTheScreen();
  expect(fetchSpy).not.toHaveBeenCalled();
});

const PREV_WEEK = WEEK.map((d, i) => ({
  ...d,
  date: `2026-10-${10 + i}`,
  ms: i === 0 ? 30 * 60_000 : 0,
}));

/** Responde según el rango pedido: la semana actual o la anterior (termina el 17 a medianoche). */
function mockWeeks(current: unknown, previous: Response | Error) {
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const from = Number(new URL((input as Request).url).searchParams.get('from'));
    const isCurrent = from === Date.UTC(2026, 9, 17, 4, 0);
    if (isCurrent) return json(current);
    if (previous instanceof Error) throw previous;
    return previous;
  });
}

const currentBody = { items: [], reports: [], totalMs: 3 * HOUR + 50 * 60_000, days: WEEK };

it('la barra más alta es la del día con más horas', async () => {
  mockWeeks(currentBody, json({ items: [], reports: [], totalMs: 0, days: PREV_WEEK }));
  await renderWithQuery(<History />);
  const tallest = await screen.findByLabelText('Domingo: 2 h sin luz');
  const other = screen.getByLabelText('Martes: 1 h 20 min sin luz');
  const heightOf = (el: Parameters<typeof within>[0]) =>
    (StyleSheet.flatten(within(el).getByTestId('bar-fill').props.style) as { height: string })
      .height;
  expect(heightOf(tallest)).toBe('100%');
  expect(parseFloat(heightOf(other) as string)).toBeCloseTo((80 / 120) * 100);
});

it('la comparación dice más o menos con su diferencia', async () => {
  mockWeeks(
    currentBody,
    json({ items: [], reports: [], totalMs: HOUR + 40 * 60_000, days: PREV_WEEK }),
  );
  await renderWithQuery(<History />);
  expect(await screen.findByText('2 h 10 min más que la semana pasada')).toBeOnTheScreen();
});

it('igual si no cambió', async () => {
  mockWeeks(currentBody, json({ ...currentBody, days: PREV_WEEK }));
  await renderWithQuery(<History />);
  expect(await screen.findByText('Igual que la semana pasada')).toBeOnTheScreen();
});

it('sin datos de la semana pasada no muestra comparación', async () => {
  mockWeeks(currentBody, new TypeError('Network request failed'));
  await renderWithQuery(<History />);
  expect(await screen.findByText('3 h 50 min')).toBeOnTheScreen();
  expect(screen.queryByText(/la semana pasada/)).toBeNull();
});

it('una semana sin cortes muestra el estado vacío', async () => {
  mockWeeks(
    { ...currentBody, totalMs: 0, days: WEEK.map((d) => ({ ...d, ms: 0 })) },
    json({ ...currentBody, days: PREV_WEEK }),
  );
  await renderWithQuery(<History />);
  expect(await screen.findByText('Sin cortes esta semana')).toBeOnTheScreen();
  expect(screen.queryByTestId('bar-fill')).toBeNull();
});

it('cada barra tiene su texto accesible', async () => {
  mockWeeks(currentBody, json({ ...currentBody, days: PREV_WEEK }));
  await renderWithQuery(<History />);
  expect(await screen.findByLabelText('Jueves: 30 min sin luz')).toBeOnTheScreen();
  expect(screen.getByLabelText('Sábado: sin cortes')).toBeOnTheScreen();
});

it('refrescar recarga las dos semanas', async () => {
  mockWeeks(currentBody, json({ ...currentBody, days: PREV_WEEK }));
  await renderWithQuery(<History />);
  await screen.findByText('3 h 50 min');
  const fetchSpy = globalThis.fetch as jest.Mock;
  fetchSpy.mockClear();
  const refreshControl = screen.getByTestId('tab-scroll').props.refreshControl;
  await act(async () => {
    refreshControl.props.onRefresh();
  });
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  const froms = fetchSpy.mock.calls.map((c) =>
    Number(new URL((c[0] as Request).url).searchParams.get('from')),
  );
  expect(froms.sort()).toEqual([Date.UTC(2026, 9, 10, 4, 0), Date.UTC(2026, 9, 17, 4, 0)]);
});

it('historial sin red después de medianoche muestra la última semana guardada', async () => {
  // Guardada el viernes 23; ya es sábado 24, 12:30 a. m. en Caracas, y la clave de la consulta cambió.
  jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 24, 4, 30));
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
  const client = createTestQueryClient();
  client.setQueryData(
    ['home', 'outages', Date.UTC(2026, 9, 17, 4, 0), Date.UTC(2026, 9, 24, 4, 0)],
    { items: [], reports: [], totalMs: 3 * HOUR + 50 * 60_000, days: WEEK },
  );
  await render(
    <QueryClientProvider client={client}>
      <History />
    </QueryClientProvider>,
  );
  expect(await screen.findByText('3 h 50 min')).toBeOnTheScreen();
  expect(
    await screen.findByText('No se pudo actualizar. Esto es lo último que se guardó.'),
  ).toBeOnTheScreen();
  expect(screen.queryByText('Reintentar')).toBeNull();
});

it('Historial con un 429 muestra el error con Reintentar y no insiste solo', async () => {
  const fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(json({ error: { code: 'rate_limited', message: 'x' } }, 429));
  await renderWithQuery(<History />);
  expect(
    await screen.findByText('Demasiados intentos. Espera un momento y reintenta.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Reintentar')).toBeOnTheScreen();
  expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(2);
});
