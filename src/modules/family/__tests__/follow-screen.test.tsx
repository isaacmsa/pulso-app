import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createTestQueryClient } from '../../../shared/query/test-client';
import FollowScreen from '../screens/FollowScreen';

const mockReplace = jest.fn();
let mockParams: { code?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const apiError = (code: string, status: number) => json({ error: { code, message: 'x' } }, status);
const ITEM = {
  homeId: '0190f3a2-7c1e-7b3a-9d4e-1a2b3c4d5e6f',
  alias: 'Casa de mamá',
  status: { state: 'con_luz', since: 1_700_000_000_000, alias: 'Casa', openOutageStart: null },
};

async function open() {
  await render(
    <QueryClientProvider client={createTestQueryClient()}>
      <FollowScreen />
    </QueryClientProvider>,
  );
}

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  mockParams = {};
  mockReplace.mockReset();
});

it('el código se escribe en mayúsculas y avisa de las letras que no existen', async () => {
  await open();
  const input = screen.getByLabelText('Código de la casa');
  await fireEvent.changeText(input, 'abcd2345');
  expect(input.props.value).toBe('ABCD2345');
  await fireEvent.changeText(input, 'abcdo345');
  expect(screen.getByText(/sin 0, 1, I, L ni O/)).toBeOnTheScreen();
});

it('seguir una casa inexistente muestra "Ese código no existe"', async () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(apiError('not_found', 404));
  await open();
  await fireEvent.changeText(screen.getByLabelText('Código de la casa'), 'ABCD2345');
  await fireEvent.changeText(screen.getByLabelText('Cómo le dices a esta casa'), 'Casa de mamá');
  await fireEvent.press(screen.getByLabelText('Seguir esta casa'));
  expect(await screen.findByText('Ese código no existe')).toBeOnTheScreen();
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});

it('con 20 casas muestra el límite', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(apiError('validation_failed', 400));
  await open();
  await fireEvent.changeText(screen.getByLabelText('Código de la casa'), 'ABCD2345');
  await fireEvent.changeText(screen.getByLabelText('Cómo le dices a esta casa'), 'Otra');
  await fireEvent.press(screen.getByLabelText('Seguir esta casa'));
  expect(await screen.findByText(/máximo de 20 casas/)).toBeOnTheScreen();
});

it('sigue con el código y el nombre y vuelve a Familia', async () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(json(ITEM, 201));
  await open();
  await fireEvent.changeText(screen.getByLabelText('Código de la casa'), 'abcd2345');
  await fireEvent.changeText(screen.getByLabelText('Cómo le dices a esta casa'), ' Casa de mamá ');
  await fireEvent.press(screen.getByLabelText('Seguir esta casa'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/family'));
  const request = fetchSpy.mock.calls[0]?.[0] as Request;
  expect(request.url).toMatch(/\/v1\/follows$/);
  expect(await request.json()).toEqual({ code: 'ABCD2345', alias: 'Casa de mamá' });
});

it('no pide nada si falta el nombre o el código es inválido', async () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  await open();
  await fireEvent.press(screen.getByLabelText('Seguir esta casa'));
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(screen.getByText(/8 letras y números/)).toBeOnTheScreen();
});

it('el código del enlace llega escrito', async () => {
  mockParams = { code: 'abcd2345' };
  await open();
  expect(screen.getByLabelText('Código de la casa').props.value).toBe('ABCD2345');
});
