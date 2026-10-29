import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import * as native from '../../power-detection/power-monitor';
import Status from '../screens/StatusScreen';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});
jest.mock('../../power-detection/power-monitor', () => ({
  getRole: jest.fn(),
  getLastServerStatus: jest.fn(),
  readEvents: jest.fn(),
  readPhoneState: jest.fn(),
  recordReport: jest.fn(),
}));

const mocked = native as jest.Mocked<typeof native>;

// Viernes 23 de octubre de 2026, 6:30 p. m. en Caracas.
const NOW = Date.UTC(2026, 9, 23, 22, 30);
const caracas = (hour: number, minute: number) => Date.UTC(2026, 9, 23, hour + 4, minute);

const snapshot = (at: number, plugged: boolean, id: string) => ({
  kind: 'snapshot' as const,
  id,
  at,
  source: 'heartbeat' as const,
  plugged,
  onWifi: plugged,
  homeWifi: null,
  internet: null,
  interactive: null,
  batteryPct: null,
});

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
  mocked.getLastServerStatus.mockResolvedValue(null);
  mocked.readEvents.mockResolvedValue({ events: [], invalid: 0 });
  mocked.readPhoneState.mockResolvedValue(null);
  mocked.recordReport.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('Estado muestra el estado que da el servidor', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    json({
      state: 'sin_luz',
      since: caracas(18, 10),
      alias: 'Casa',
      openOutageStart: caracas(18, 5),
    }),
  );
  await renderWithQuery(<Status />);
  expect(await screen.findByText('Se fue la luz a las 6:05 p. m. (25 min)')).toBeOnTheScreen();
  expect(screen.getByText('Casa')).toBeOnTheScreen();
});

it('Estado muestra el último estado del servidor sin red', async () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
  mocked.getLastServerStatus.mockResolvedValue({
    status: { state: 'con_luz', since: caracas(14, 30), alias: 'Casa', openOutageStart: null },
    receivedAt: NOW - 20 * 60_000,
  });
  await renderWithQuery(<Status />);
  expect(await screen.findByText('Hay luz desde las 2:30 p. m.')).toBeOnTheScreen();
  expect(screen.getByText(/hace 20 min/)).toBeOnTheScreen();
});

it('Estado sin red y sin último estado guardado pide reintentar', async () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
  await renderWithQuery(<Status />);
  expect(
    await screen.findByText('Sin conexión con el servidor. Revisa tu internet.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Reintentar')).toBeOnTheScreen();
});

it('Estado muestra el error cuando la respuesta no cumple el contrato', async () => {
  // Un estado que esta versión de la app no conoce: la pantalla dice que no lo entiende y no se cae.
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      json({ state: 'explotando', since: caracas(14, 30), alias: 'Casa', openOutageStart: null }),
    );
  await renderWithQuery(<Status />);
  expect(
    await screen.findByText(
      'El servidor respondió algo que esta versión no entiende. Actualiza la app.',
    ),
  ).toBeOnTheScreen();
  expect(screen.getByText('Reintentar')).toBeOnTheScreen();
});

it('Estado muestra lo que dice el teléfono: sin corriente desde que dejó de estar en corriente', async () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
  mocked.readPhoneState.mockResolvedValue({ plugged: false, since: caracas(18, 5) });
  await renderWithQuery(<Status />);
  expect(await screen.findByText('Sin corriente desde las 6:05 p. m.')).toBeOnTheScreen();
});

it('Estado da el inicio real de una racha de una semana, aunque pase de 500 eventos', async () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
  // Los últimos 500 eventos (lo más que devuelve getEvents) cubren solo los últimos 2 días, todos enchufados.
  mocked.readEvents.mockResolvedValue({
    events: Array.from({ length: 500 }, (_, i) =>
      snapshot(
        NOW - i * 5 * 60_000,
        true,
        `01900000-0000-7000-8000-${String(i).padStart(12, '0')}`,
      ),
    ),
    invalid: 0,
  });
  // El nativo recorre todos los snapshots guardados: enchufado desde hace una semana.
  mocked.readPhoneState.mockResolvedValue({ plugged: true, since: NOW - 7 * 24 * 60 * 60_000 });
  await renderWithQuery(<Status />);
  expect(
    await screen.findByText('Con corriente desde el 16/10 a las 6:30 p. m.'),
  ).toBeOnTheScreen();
});

it('Estado dice que todavía no hay lecturas si el teléfono no ha guardado nada', async () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
  await renderWithQuery(<Status />);
  expect(await screen.findByText('Todavía no hay lecturas de este teléfono.')).toBeOnTheScreen();
});

it.each([
  ['Hay luz', 'hay_luz'],
  ['Fluctuando', 'fluctuando'],
  ['Sin luz', 'sin_luz'],
])('el botón "%s" guarda un reporte %s', async (label, value) => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
  await renderWithQuery(<Status />);
  await fireEvent.press(await screen.findByText(label));
  await waitFor(() => expect(mocked.recordReport).toHaveBeenCalledWith(value));
  expect(await screen.findByText('Listo, quedó anotado.')).toBeOnTheScreen();
});

it('un teléfono que solo sigue casas no pide nada y lo dice', async () => {
  mocked.getRole.mockResolvedValue('follow');
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  await renderWithQuery(<Status />);
  expect(await screen.findByText('Este teléfono solo sigue casas')).toBeOnTheScreen();
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(mocked.readPhoneState).not.toHaveBeenCalled();
});
