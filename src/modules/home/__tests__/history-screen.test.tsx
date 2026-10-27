import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import History from '../../../../app/(tabs)/history';
import * as native from '../../power-detection/power-monitor';

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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
