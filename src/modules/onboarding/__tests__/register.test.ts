import { ApiError } from '../../../shared/api/client';
import { createHome, registerDevice } from '../../../shared/api/generated';
import * as native from '../../power-detection/power-monitor';
import { register } from '../register';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '0.1.0' } },
}));
jest.mock('../../power-detection/power-monitor', () => ({
  storeToken: jest.fn(),
  getToken: jest.fn(),
  isTokenInvalid: jest.fn(),
  markTokenInvalid: jest.fn(),
  configureApi: jest.fn(),
  arm: jest.fn(),
  setRole: jest.fn(),
  requestUpload: jest.fn(),
  setOnboardingStep: jest.fn(),
}));
jest.mock('../../../shared/api/generated', () => ({
  registerDevice: jest.fn(),
  createHome: jest.fn(),
}));

const mocked = native as jest.Mocked<typeof native>;
const registerDeviceMock = registerDevice as unknown as jest.Mock;
const createHomeMock = createHome as unknown as jest.Mock;

const TOKEN = 'a'.repeat(87);
const ok = (data: unknown) => ({ data, response: new Response(null, { status: 200 }) });
const failed = (code: string, status: number) => ({
  error: { error: { code, message: 'x' } },
  response: new Response(null, { status }),
});

let vaultToken: string | null;
let invalid: boolean;

beforeEach(() => {
  jest.resetAllMocks();
  vaultToken = null;
  invalid = false;
  mocked.getToken.mockImplementation(async () => vaultToken);
  mocked.isTokenInvalid.mockImplementation(async () => invalid);
  mocked.storeToken.mockImplementation(async (token) => {
    vaultToken = token;
    invalid = false;
  });
  mocked.markTokenInvalid.mockImplementation(async (token) => {
    if (token === vaultToken) invalid = true;
  });
  mocked.configureApi.mockResolvedValue(undefined);
  mocked.arm.mockResolvedValue(undefined);
  mocked.setRole.mockResolvedValue(undefined);
  mocked.requestUpload.mockResolvedValue(undefined);
  mocked.setOnboardingStep.mockResolvedValue(undefined);
  registerDeviceMock.mockResolvedValue(ok({ deviceId: 'd', token: TOKEN }));
  createHomeMock.mockResolvedValue(ok({ homeId: 'h', shareCode: 'ABCDEFGH' }));
});

it('registra una sola vez aunque se llame dos veces', async () => {
  await register('watch');
  await register('watch');
  expect(registerDeviceMock).toHaveBeenCalledTimes(1);
  expect(registerDeviceMock).toHaveBeenCalledWith({ body: { appVersion: '0.1.0' } });
  expect(mocked.storeToken).toHaveBeenCalledTimes(1);
  expect(mocked.storeToken).toHaveBeenCalledWith(TOKEN);
});

it('dos llamadas a la vez comparten un solo registro', async () => {
  await Promise.all([register('watch'), register('watch')]);
  expect(registerDeviceMock).toHaveBeenCalledTimes(1);
});

it('vigilar: guarda el token, avisa a la subida, arma, crea la casa y pide subir ya', async () => {
  await register('watch');
  expect(mocked.storeToken).toHaveBeenCalledWith(TOKEN);
  expect(mocked.configureApi).toHaveBeenCalledTimes(1);
  expect(mocked.arm).toHaveBeenCalledTimes(1);
  expect(createHomeMock).toHaveBeenCalledTimes(1);
  expect(mocked.requestUpload).toHaveBeenCalledTimes(1);
  expect(mocked.setRole).toHaveBeenCalledWith('watch');
});

it('home_exists cuenta como éxito', async () => {
  createHomeMock.mockResolvedValue(failed('home_exists', 409));
  await expect(register('watch')).resolves.toBeUndefined();
  expect(mocked.requestUpload).toHaveBeenCalledTimes(1);
  expect(mocked.setRole).toHaveBeenCalledWith('watch');
});

it('otro error al crear la casa se propaga, no pide subir y el onboarding sigue en el paso del rol', async () => {
  createHomeMock.mockResolvedValue(failed('internal_error', 500));
  await expect(register('watch')).rejects.toMatchObject({ code: 'internal_error' });
  expect(mocked.requestUpload).not.toHaveBeenCalled();
  expect(mocked.setOnboardingStep).toHaveBeenCalledWith('role');
  expect(mocked.setOnboardingStep).not.toHaveBeenCalledWith('notifications');
});

it('vigilar después de seguir arma antes de los pasos de batería', async () => {
  const order: string[] = [];
  mocked.setRole.mockImplementation(async (role) => {
    order.push(`setRole:${role}`);
  });
  mocked.arm.mockImplementation(async () => {
    order.push('arm');
  });
  mocked.setOnboardingStep.mockImplementation(async (step) => {
    order.push(`step:${step}`);
  });
  await register('follow');
  order.length = 0;
  await register('watch');
  // El rol watch se guarda antes de arm(): ensureArmed no sale temprano, y el teléfono queda armado
  // durante los pasos siguientes aunque la app muera en ellos.
  expect(order.indexOf('setRole:watch')).toBeGreaterThanOrEqual(0);
  expect(order.indexOf('setRole:watch')).toBeLessThan(order.indexOf('arm'));
  expect(order.indexOf('arm')).toBeLessThan(order.indexOf('step:notifications'));
});

it('si falló al crear la casa, el reintento no registra otro dispositivo y la completa', async () => {
  createHomeMock.mockResolvedValueOnce(failed('internal_error', 500));
  await expect(register('watch')).rejects.toBeInstanceOf(ApiError);
  await expect(register('watch')).resolves.toBeUndefined();
  expect(registerDeviceMock).toHaveBeenCalledTimes(1);
  expect(createHomeMock).toHaveBeenCalledTimes(2);
  expect(mocked.setRole).toHaveBeenCalledWith('watch');
});

it('Solo seguir no arma la detección, no crea casa y no pide subir', async () => {
  await register('follow');
  expect(mocked.setRole).toHaveBeenCalledWith('follow');
  expect(mocked.storeToken).toHaveBeenCalledWith(TOKEN);
  expect(mocked.arm).not.toHaveBeenCalled();
  expect(createHomeMock).not.toHaveBeenCalled();
  expect(mocked.requestUpload).not.toHaveBeenCalled();
});

it('Solo seguir guarda el rol antes de tocar la red', async () => {
  registerDeviceMock.mockRejectedValue(new TypeError('Network request failed'));
  await expect(register('follow')).rejects.toMatchObject({ code: 'network' });
  expect(mocked.setRole).toHaveBeenCalledWith('follow');
  expect(mocked.arm).not.toHaveBeenCalled();
});

it('con el token inválido registra de nuevo', async () => {
  vaultToken = 'viejo';
  invalid = true;
  await register('watch');
  expect(registerDeviceMock).toHaveBeenCalledTimes(1);
  expect(mocked.storeToken).toHaveBeenCalledWith(TOKEN);
});

it('sin red el registro falla con ApiError network, sin guardar nada ni armar', async () => {
  registerDeviceMock.mockRejectedValue(new TypeError('Network request failed'));
  await expect(register('watch')).rejects.toMatchObject({ code: 'network' });
  expect(mocked.storeToken).not.toHaveBeenCalled();
  expect(mocked.arm).not.toHaveBeenCalled();
  // el fallo no deja trabado el siguiente intento
  registerDeviceMock.mockResolvedValue(ok({ deviceId: 'd', token: TOKEN }));
  await expect(register('watch')).resolves.toBeUndefined();
});

it('marca el onboarding como pendiente antes de registrar y deja el siguiente paso al terminar', async () => {
  const order: string[] = [];
  mocked.setOnboardingStep.mockImplementation(async (step) => {
    order.push(`step:${step}`);
  });
  registerDeviceMock.mockImplementation(async () => {
    order.push('registerDevice');
    return ok({ deviceId: 'd', token: TOKEN });
  });
  await register('watch');
  expect(order[0]).toBe('step:role');
  expect(order.indexOf('registerDevice')).toBeGreaterThan(0);
  expect(order[order.length - 1]).toBe('step:notifications');
});

it('si el registro falla, el onboarding queda en el paso del rol', async () => {
  registerDeviceMock.mockRejectedValue(new TypeError('Network request failed'));
  await expect(register('watch')).rejects.toMatchObject({ code: 'network' });
  expect(mocked.setOnboardingStep).toHaveBeenCalledWith('role');
  expect(mocked.setOnboardingStep).not.toHaveBeenCalledWith('notifications');
});

// Un token que el teléfono cree válido pero que el servidor ya borró: createHome da 401 en cada reintento y el
// onboarding quedaba en un lazo sin salida.
it('si createHome da 401, registra de nuevo una sola vez', async () => {
  vaultToken = 'viejo';
  createHomeMock
    .mockResolvedValueOnce(failed('invalid_token', 401))
    .mockResolvedValue(ok({ homeId: 'h', shareCode: 'ABCDEFGH' }));
  await expect(register('watch')).resolves.toBeUndefined();
  expect(mocked.markTokenInvalid).toHaveBeenCalledWith('viejo');
  expect(registerDeviceMock).toHaveBeenCalledTimes(1);
  expect(mocked.storeToken).toHaveBeenCalledWith(TOKEN);
  expect(createHomeMock).toHaveBeenCalledTimes(2);
  expect(mocked.requestUpload).toHaveBeenCalledTimes(1);
  expect(mocked.setOnboardingStep).toHaveBeenLastCalledWith('notifications');
});

it('si createHome sigue dando 401 con el token nuevo, falla sin registrar otra vez', async () => {
  vaultToken = 'viejo';
  createHomeMock.mockResolvedValue(failed('invalid_token', 401));
  await expect(register('watch')).rejects.toMatchObject({ code: 'invalid_token' });
  expect(registerDeviceMock).toHaveBeenCalledTimes(1);
  expect(createHomeMock).toHaveBeenCalledTimes(2);
  expect(mocked.requestUpload).not.toHaveBeenCalled();
});
