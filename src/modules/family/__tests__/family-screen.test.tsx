import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { createTestQueryClient } from '../../../shared/query/test-client';
import * as native from '../../power-detection/power-monitor';
import FamilyScreen from '../screens/FamilyScreen';
import { clearShareCode, saveShareCode } from '../share-code';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
    useRouter: () => ({ push: mockPush }),
  };
});
jest.mock('../../power-detection/power-monitor', () => ({ getRole: jest.fn() }));
const mocked = native as jest.Mocked<typeof native>;

const NOW = Date.UTC(2026, 10, 3, 22, 30);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const house = (id: string, alias: string, state: 'con_luz' | 'sin_luz' = 'con_luz') => ({
  homeId: id,
  alias,
  status: {
    state,
    since: NOW - 3_600_000,
    alias: 'Nombre del dueño',
    openOutageStart: state === 'sin_luz' ? NOW - 3_600_000 : null,
  },
});
const MAMA = house('0190f3a2-7c1e-7b3a-9d4e-1a2b3c4d5e01', 'Casa de mamá');
const TIA = house('0190f3a2-7c1e-7b3a-9d4e-1a2b3c4d5e02', 'Casa de la tía', 'sin_luz');

async function open() {
  await render(
    <QueryClientProvider client={createTestQueryClient()}>
      <FamilyScreen />
    </QueryClientProvider>,
  );
}

afterEach(() => jest.restoreAllMocks());

beforeEach(async () => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mockPush.mockReset();
  mocked.getRole.mockResolvedValue('watch');
  await AsyncStorage.clear();
  await clearShareCode();
});

it('un teléfono que solo sigue ve sus casas, con el nombre que les puso', async () => {
  mocked.getRole.mockResolvedValue('follow');
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(json({ items: [MAMA, TIA] }));
  await open();
  expect(await screen.findByText('Casa de mamá')).toBeOnTheScreen();
  expect(screen.getByText('Casa de la tía')).toBeOnTheScreen();
  expect(screen.getByText(/Hay luz desde/)).toBeOnTheScreen();
  expect(screen.getByText(/Se fue la luz/)).toBeOnTheScreen();
  // Quien solo sigue no tiene casa propia que compartir.
  expect(screen.queryByLabelText('Compartir mi casa')).toBeNull();
});

it('sin casas, invita a seguir una', async () => {
  mocked.getRole.mockResolvedValue('follow');
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(json({ items: [] }));
  await open();
  expect(await screen.findByText(/Todavía no sigues ninguna casa/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('Seguir una casa'));
  expect(mockPush).toHaveBeenCalledWith('/follow');
});

it('dejar de seguir la quita de la lista', async () => {
  mocked.getRole.mockResolvedValue('follow');
  let items = [MAMA, TIA];
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    if (request.method === 'DELETE') {
      items = items.filter((item) => !request.url.endsWith(item.homeId));
      return new Response(null, { status: 204 });
    }
    return json({ items });
  });
  await open();
  await screen.findByText('Casa de mamá');
  await fireEvent.press(screen.getByLabelText('Dejar de seguir Casa de mamá'));
  await waitFor(() => expect(screen.queryByText('Casa de mamá')).toBeNull());
  expect(screen.getByText('Casa de la tía')).toBeOnTheScreen();
  const deletes = fetchSpy.mock.calls.filter(([input]) => (input as Request).method === 'DELETE');
  expect(deletes).toHaveLength(1);
});

it('compartir arma el mensaje con el enlace', async () => {
  await saveShareCode('ABCD2345');
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(json({ items: [] }));
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  await open();
  await fireEvent.press(await screen.findByLabelText('Compartir mi casa'));
  await waitFor(() =>
    expect(share).toHaveBeenCalledWith({
      message:
        'Sigue la luz de mi casa en Pulso: https://pulso-api.isaac-mendozasa.workers.dev/c/ABCD2345',
    }),
  );
});

it('sin código guardado, compartir pide confirmación antes de regenerar', async () => {
  const fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input) =>
      (input as Request).method === 'POST' ? json({ shareCode: 'WXYZ2345' }) : json({ items: [] }),
    );
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  await open();
  const posts = () => fetchSpy.mock.calls.filter(([i]) => (i as Request).method === 'POST');
  await fireEvent.press(await screen.findByLabelText('Compartir mi casa'));
  expect(
    screen.getByText(
      'Para compartir hay que crear un código nuevo. Las personas que ya siguen tu casa dejarán de verla hasta que les mandes el código nuevo',
    ),
  ).toBeOnTheScreen();
  expect(posts()).toHaveLength(0);
  expect(share).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Sí, crear código y compartir'));
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(share.mock.calls[0]?.[0].message).toContain('/c/WXYZ2345');
  expect(posts()).toHaveLength(1);
});

it('sin código guardado, cancelar no regenera ni comparte', async () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(json({ items: [] }));
  const share = jest.spyOn(Share, 'share');
  await open();
  await fireEvent.press(await screen.findByLabelText('Compartir mi casa'));
  await fireEvent.press(screen.getByLabelText('Cancelar'));
  expect(share).not.toHaveBeenCalled();
  expect(fetchSpy.mock.calls.every(([i]) => (i as Request).method === 'GET')).toBe(true);
});

it('regenerar pide confirmación y muestra el código nuevo', async () => {
  await saveShareCode('ABCD2345');
  const fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input) =>
      (input as Request).method === 'POST' ? json({ shareCode: 'WXYZ2345' }) : json({ items: [] }),
    );
  await open();
  await screen.findByText('ABCD2345');
  await fireEvent.press(screen.getByLabelText('Regenerar código'));
  expect(
    screen.getByText(
      'Las personas que siguen tu casa dejarán de verla hasta que les mandes el código nuevo',
    ),
  ).toBeOnTheScreen();
  const posts = () => fetchSpy.mock.calls.filter(([i]) => (i as Request).method === 'POST');
  expect(posts()).toHaveLength(0);
  await fireEvent.press(screen.getByLabelText('Sí, regenerar'));
  expect(await screen.findByText('WXYZ2345')).toBeOnTheScreen();
  expect(posts()).toHaveLength(1);
  expect(screen.queryByText('ABCD2345')).toBeNull();
  expect(await AsyncStorage.getItem('pulso-share-code')).toBe('WXYZ2345');
});

it('cancelar la confirmación no toca el código', async () => {
  await saveShareCode('ABCD2345');
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(json({ items: [] }));
  await open();
  await screen.findByText('ABCD2345');
  await fireEvent.press(screen.getByLabelText('Regenerar código'));
  await fireEvent.press(screen.getByLabelText('Cancelar'));
  expect(screen.getByText('ABCD2345')).toBeOnTheScreen();
  expect(fetchSpy.mock.calls.every(([i]) => (i as Request).method === 'GET')).toBe(true);
});

it('si la lista falla, ofrece reintentar', async () => {
  mocked.getRole.mockResolvedValue('follow');
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
  await open();
  expect(
    await screen.findByText('Sin conexión con el servidor. Revisa tu internet.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Reintentar')).toBeOnTheScreen();
});
