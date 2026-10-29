import { setInvalidTokenHandler, setTokenProvider } from '../../../shared/api/client';
import * as native from '../../power-detection/power-monitor';
import { deleteMyData } from '../delete-data';

jest.mock('../../power-detection/power-monitor', () => ({
  getToken: jest.fn(),
  wipe: jest.fn(),
}));
jest.mock('../../../shared/query/client', () => ({ clearQueryCache: jest.fn() }));

const mocked = native as jest.Mocked<typeof native>;

afterEach(() => {
  jest.restoreAllMocks();
  setInvalidTokenHandler(null);
  setTokenProvider(async () => null);
});

it('un 401 de deleteDevice no dispara el regreso al onboarding por token inválido', async () => {
  const onInvalid = jest.fn();
  setInvalidTokenHandler(onInvalid);
  setTokenProvider(async () => 'tok');
  mocked.getToken.mockResolvedValue('tok');
  mocked.wipe.mockResolvedValue(undefined);
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'invalid_token', message: 'x' } }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }),
  );

  // El 401 cuenta como confirmado (D-031): se limpia el teléfono y no hay nada más que hacer.
  await expect(deleteMyData()).resolves.toBeUndefined();
  const sent = fetchSpy.mock.calls[0]?.[0] as Request | undefined;
  expect(sent?.headers.get('authorization')).toBe('Bearer tok');
  expect(onInvalid).not.toHaveBeenCalled();
  expect(mocked.wipe).toHaveBeenCalledTimes(1);
});
