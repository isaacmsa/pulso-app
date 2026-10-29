import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Linking, Platform } from 'react-native';
import { STAGING_API_URL } from '../../../shared/api/client';
import { clearQueryCache } from '../../../shared/query/client';
import { createTestQueryClient } from '../../../shared/query/test-client';
import { notifyStartupChanged } from '../../onboarding/startup';
import * as native from '../../power-detection/power-monitor';
import Settings from '../screens/SettingsScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../onboarding/startup', () => ({ notifyStartupChanged: jest.fn() }));
jest.mock('../../../shared/query/client', () => ({ clearQueryCache: jest.fn() }));
jest.mock('../../power-detection/power-monitor', () => ({
  getRole: jest.fn(),
  getToken: jest.fn(),
  setOnboardingStep: jest.fn(),
  wipe: jest.fn(),
  isForegroundServiceEnabled: jest.fn(),
  setForegroundServiceEnabled: jest.fn(),
}));

const mocked = native as jest.Mocked<typeof native>;
const status = { state: 'con_luz', since: 1793628000000, alias: 'Casa', openOutageStart: null };

function json(body: unknown, statusCode = 200): Response {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'content-type': 'application/json' },
  });
}

type Handler = (request: Request) => Response | Promise<Response>;

/** Responde por método: el estado de la casa para el alias y lo que se pida para el resto. */
function mockApi(handlers: { delete?: Handler; patch?: Handler }) {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    if (request.method === 'GET') return json(status);
    const handler = request.method === 'DELETE' ? handlers.delete : handlers.patch;
    if (!handler) throw new Error(`sin respuesta para ${request.method}`);
    return handler(request);
  });
}

const offline = () => {
  throw new TypeError('Network request failed');
};

function renderWithQuery(ui: ReactElement) {
  const client = createTestQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function askToDelete() {
  await fireEvent.press(await screen.findByText('Borrar mis datos'));
  await fireEvent.press(await screen.findByText('Sí, borrar'));
}

const noLocalChanges = () => {
  expect(mocked.wipe).not.toHaveBeenCalled();
  expect(clearQueryCache).not.toHaveBeenCalled();
  expect(notifyStartupChanged).not.toHaveBeenCalled();
};

beforeEach(() => {
  mocked.getRole.mockResolvedValue('watch');
  mocked.getToken.mockResolvedValue('a'.repeat(87));
  mocked.setOnboardingStep.mockResolvedValue(undefined);
  mocked.wipe.mockResolvedValue(undefined);
  mocked.isForegroundServiceEnabled.mockResolvedValue(false);
  mocked.setForegroundServiceEnabled.mockResolvedValue(undefined);
  (clearQueryCache as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('Borrar mis datos', () => {
  it('sin red, borrar no toca el teléfono y muestra el error', async () => {
    mockApi({ delete: offline });
    await renderWithQuery(<Settings />);
    await askToDelete();
    expect(
      await screen.findByText(
        'No se pudo borrar: no hay conexión con el servidor. No se tocó nada en este teléfono.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
    noLocalChanges();
  });

  it('al reintentar con red borra todo', async () => {
    let online = false;
    mockApi({ delete: () => (online ? new Response(null, { status: 204 }) : offline()) });
    await renderWithQuery(<Settings />);
    await askToDelete();
    expect(await screen.findByText(/No se pudo borrar/)).toBeOnTheScreen();
    noLocalChanges();
    online = true;
    await fireEvent.press(screen.getByText('Reintentar'));
    await waitFor(() => expect(mocked.wipe).toHaveBeenCalledTimes(1));
    expect(notifyStartupChanged).toHaveBeenCalledTimes(1);
  });

  it('con 204, borrar llama a wipe y vuelve al onboarding', async () => {
    const fetchSpy = mockApi({ delete: () => new Response(null, { status: 204 }) });
    await renderWithQuery(<Settings />);
    await askToDelete();
    await waitFor(() => expect(notifyStartupChanged).toHaveBeenCalledTimes(1));
    const deleteRequest = fetchSpy.mock.calls
      .map(([input]) => input as Request)
      .find((request) => request.method === 'DELETE');
    expect(new URL(deleteRequest?.url ?? '').pathname).toBe('/v1/devices/me');
    expect(mocked.wipe).toHaveBeenCalledTimes(1);
    expect(clearQueryCache).toHaveBeenCalledTimes(1);
  });

  it('si el servidor ya no conoce el dispositivo (401), también borra lo local', async () => {
    mockApi({
      delete: () => json({ error: { code: 'invalid_token', message: 'Token inválido' } }, 401),
    });
    await renderWithQuery(<Settings />);
    await askToDelete();
    await waitFor(() => expect(notifyStartupChanged).toHaveBeenCalledTimes(1));
    expect(mocked.wipe).toHaveBeenCalledTimes(1);
  });

  it('si el servidor falla (500), no toca el teléfono y ofrece reintentar', async () => {
    mockApi({
      delete: () => json({ error: { code: 'internal_error', message: 'Error' } }, 500),
    });
    await renderWithQuery(<Settings />);
    await askToDelete();
    expect(await screen.findByText(/No se pudo borrar/)).toBeOnTheScreen();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
    noLocalChanges();
  });

  it('si el borrado local falla, lo dice y no vuelve al onboarding', async () => {
    mockApi({ delete: () => new Response(null, { status: 204 }) });
    mocked.wipe.mockRejectedValue(new Error('disco'));
    await renderWithQuery(<Settings />);
    await askToDelete();
    expect(
      await screen.findByText(
        'Se borró en el servidor, pero no se pudo limpiar este teléfono. Toca reintentar.',
      ),
    ).toBeOnTheScreen();
    expect(notifyStartupChanged).not.toHaveBeenCalled();
  });

  // Sin token el pedido sale sin Authorization y el 401 contaría como confirmado (D-031): el teléfono se
  // limpiaría y la copia del servidor quedaría.
  it('sin token, borrar no toca nada y explica cómo pedir el borrado', async () => {
    mocked.getToken.mockResolvedValue(null);
    const fetchSpy = mockApi({
      delete: () => json({ error: { code: 'invalid_token', message: 'Token inválido' } }, 401),
    });
    await renderWithQuery(<Settings />);
    await askToDelete();
    expect(
      await screen.findByText(/https:\/\/pulso-api\.isaac-mendozasa\.workers\.dev\/borrar-datos/),
    ).toBeOnTheScreen();
    expect(fetchSpy.mock.calls.some(([input]) => (input as Request).method === 'DELETE')).toBe(
      false,
    );
    noLocalChanges();
  });

  it('pide confirmar y cancelar no hace nada', async () => {
    const fetchSpy = mockApi({ delete: () => new Response(null, { status: 204 }) });
    await renderWithQuery(<Settings />);
    await fireEvent.press(await screen.findByText('Borrar mis datos'));
    await fireEvent.press(await screen.findByText('Cancelar'));
    expect(fetchSpy.mock.calls.some(([input]) => (input as Request).method === 'DELETE')).toBe(
      false,
    );
    noLocalChanges();
  });
});

describe('Mi router tiene UPS', () => {
  const patches = (spy: jest.SpyInstance) =>
    spy.mock.calls.map(([r]) => r as Request).filter((r) => r.method === 'PATCH');

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('activar UPS llama a updateHome con mode ups', async () => {
    const fetchSpy = mockApi({ patch: () => new Response(null, { status: 204 }) });
    await renderWithQuery(<Settings />);
    await fireEvent(await screen.findByLabelText('Mi router tiene UPS'), 'valueChange', true);
    await waitFor(() => expect(patches(fetchSpy)).toHaveLength(1));
    expect(await patches(fetchSpy)[0]?.clone().json()).toEqual({ mode: 'ups' });
    await waitFor(() =>
      expect(screen.getByLabelText('Mi router tiene UPS').props.value).toBe(true),
    );
  });

  it('desactivar llama con base', async () => {
    await AsyncStorage.setItem('pulso-router-ups', 'ups');
    const fetchSpy = mockApi({ patch: () => new Response(null, { status: 204 }) });
    await renderWithQuery(<Settings />);
    await waitFor(() =>
      expect(screen.getByLabelText('Mi router tiene UPS').props.value).toBe(true),
    );
    await fireEvent(screen.getByLabelText('Mi router tiene UPS'), 'valueChange', false);
    await waitFor(() => expect(patches(fetchSpy)).toHaveLength(1));
    expect(await patches(fetchSpy)[0]?.clone().json()).toEqual({ mode: 'base' });
  });

  it('si falla, el interruptor vuelve y muestra el error', async () => {
    mockApi({ patch: offline });
    await renderWithQuery(<Settings />);
    await fireEvent(await screen.findByLabelText('Mi router tiene UPS'), 'valueChange', true);
    expect(await screen.findByText(/Sin conexión con el servidor/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Mi router tiene UPS').props.value).toBe(false);
  });

  it('un teléfono que solo sigue no ve el interruptor', async () => {
    mocked.getRole.mockResolvedValue('follow');
    await renderWithQuery(<Settings />);
    expect(await screen.findByText('Borrar mis datos')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Mi router tiene UPS')).toBeNull();
  });
});

describe('Ajustes', () => {
  it('guarda el alias con updateHome', async () => {
    const fetchSpy = mockApi({ patch: () => new Response(null, { status: 204 }) });
    await renderWithQuery(<Settings />);
    const input = await screen.findByDisplayValue('Casa');
    await fireEvent.changeText(input, '  Casa de mamá ');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText('Listo, guardado.')).toBeOnTheScreen();
    const patch = fetchSpy.mock.calls
      .map(([request]) => request as Request)
      .find((request) => request.method === 'PATCH');
    expect(new URL(patch?.url ?? '').pathname).toBe('/v1/homes/me');
    expect(await patch?.clone().json()).toEqual({ alias: 'Casa de mamá' });
  });

  it('no guarda un alias vacío', async () => {
    const fetchSpy = mockApi({});
    await renderWithQuery(<Settings />);
    await fireEvent.changeText(await screen.findByDisplayValue('Casa'), '   ');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText('Escribe un nombre de hasta 40 letras.')).toBeOnTheScreen();
    expect(fetchSpy.mock.calls.some(([input]) => (input as Request).method === 'PATCH')).toBe(
      false,
    );
  });

  it('Diagnóstico abre el registrador', async () => {
    mockApi({});
    await renderWithQuery(<Settings />);
    await fireEvent.press(await screen.findByText('Diagnóstico'));
    expect(mockPush).toHaveBeenCalledWith('/debug');
  });

  it('la política de privacidad abre /privacidad de la API', async () => {
    mockApi({});
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderWithQuery(<Settings />);
    await fireEvent.press(await screen.findByText('Política de privacidad'));
    expect(open).toHaveBeenCalledWith(`${STAGING_API_URL}/privacidad`);
  });

  it('el interruptor de D enciende el servicio en primer plano', async () => {
    mockApi({});
    const original = Platform.Version;
    Object.defineProperty(Platform, 'Version', { value: 31, configurable: true });
    try {
      await renderWithQuery(<Settings />);
      await fireEvent(
        await screen.findByLabelText('Servicio en primer plano'),
        'valueChange',
        true,
      );
      await waitFor(() => expect(mocked.setForegroundServiceEnabled).toHaveBeenCalledWith(true));
    } finally {
      Object.defineProperty(Platform, 'Version', { value: original, configurable: true });
    }
  });

  it('un teléfono que solo sigue casas no ve alias ni el servicio, pero sí borrar y privacidad', async () => {
    mocked.getRole.mockResolvedValue('follow');
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    await renderWithQuery(<Settings />);
    expect(await screen.findByText('Borrar mis datos')).toBeOnTheScreen();
    expect(screen.getByText('Política de privacidad')).toBeOnTheScreen();
    expect(screen.getByText('Diagnóstico')).toBeOnTheScreen();
    expect(screen.queryByText('Guardar')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('un teléfono que solo sigue casas puede pasar a vigilar esta casa sin borrar nada', async () => {
    mocked.getRole.mockResolvedValue('follow');
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    await renderWithQuery(<Settings />);
    await fireEvent.press(await screen.findByText('Vigilar esta casa'));
    // Vuelve al paso del rol del onboarding: el token y el registro quedan como están.
    await waitFor(() => expect(notifyStartupChanged).toHaveBeenCalledTimes(1));
    expect(mocked.setOnboardingStep).toHaveBeenCalledWith('role');
    expect(mocked.wipe).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('un teléfono que vigila no ve Vigilar esta casa', async () => {
    mockApi({});
    await renderWithQuery(<Settings />);
    expect(await screen.findByText('Borrar mis datos')).toBeOnTheScreen();
    expect(screen.queryByText('Vigilar esta casa')).toBeNull();
  });
});
