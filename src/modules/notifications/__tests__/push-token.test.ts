import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { updateDevice } from '../../../shared/api/generated';
import * as native from '../../power-detection/power-monitor';
import { registerPushToken, resetPushTokenCache, startPushTokenSync } from '../push-token';

let mockConstants: { expoConfig?: unknown; easConfig?: unknown };
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockConstants.expoConfig;
    },
    get easConfig() {
      return mockConstants.easConfig;
    },
  },
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(),
}));
jest.mock('../../power-detection/power-monitor', () => ({ getToken: jest.fn() }));
jest.mock('../../../shared/api/generated', () => ({ updateDevice: jest.fn() }));

const notifications = Notifications as jest.Mocked<typeof Notifications>;
const mocked = native as jest.Mocked<typeof native>;
const updateDeviceMock = updateDevice as unknown as jest.Mock;

const PUSH = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const ok = { data: { ok: true }, response: new Response(null, { status: 200 }) };

let infoSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.resetAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  resetPushTokenCache();
  mockConstants = { expoConfig: { extra: { eas: { projectId: 'proj-123' } } } };
  notifications.setNotificationChannelAsync.mockResolvedValue(null);
  notifications.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
  notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: PUSH });
  mocked.getToken.mockResolvedValue('device-token');
  updateDeviceMock.mockResolvedValue(ok);
  infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  infoSpy.mockRestore();
  warnSpy.mockRestore();
});

describe('registerPushToken', () => {
  it('crea el canal cortes con importancia alta y manda el push token', async () => {
    await registerPushToken();
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'cortes',
      expect.objectContaining({ importance: Notifications.AndroidImportance.HIGH }),
    );
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-123' });
    expect(updateDeviceMock).toHaveBeenCalledWith({ body: { pushToken: PUSH } });
  });

  it('manda el push token una sola vez si no cambió', async () => {
    await registerPushToken();
    await registerPushToken();
    expect(updateDeviceMock).toHaveBeenCalledTimes(1);

    notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: `${PUSH}-nuevo` });
    await registerPushToken();
    expect(updateDeviceMock).toHaveBeenCalledTimes(2);
    expect(updateDeviceMock).toHaveBeenLastCalledWith({ body: { pushToken: `${PUSH}-nuevo` } });
  });

  it('dos llamadas a la vez comparten el mismo trabajo', async () => {
    await Promise.all([registerPushToken(), registerPushToken()]);
    expect(updateDeviceMock).toHaveBeenCalledTimes(1);
  });

  it('si el teléfono se registró de nuevo, vuelve a mandarlo (el dispositivo nuevo no lo tiene)', async () => {
    await registerPushToken();
    mocked.getToken.mockResolvedValue('otro-device-token');
    await registerPushToken();
    expect(updateDeviceMock).toHaveBeenCalledTimes(2);
  });

  it('sin permiso no llama a updateDevice', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
    await registerPushToken();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(updateDeviceMock).not.toHaveBeenCalled();
  });

  it('sin projectId no pide token ni llama a updateDevice', async () => {
    mockConstants = { expoConfig: { extra: {} } };
    await registerPushToken();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(updateDeviceMock).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('ExponentPushToken');
  });

  it('toma el projectId de easConfig si expoConfig no lo trae', async () => {
    mockConstants = { expoConfig: {}, easConfig: { projectId: 'from-eas' } };
    await registerPushToken();
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'from-eas' });
  });

  it('sin token del dispositivo (todavía no se registró) no llama a updateDevice', async () => {
    mocked.getToken.mockResolvedValue(null);
    await registerPushToken();
    expect(updateDeviceMock).not.toHaveBeenCalled();
  });

  it('si Expo o la API fallan no lanza, no registra el token y lo reintenta en la próxima', async () => {
    notifications.getExpoPushTokenAsync.mockRejectedValueOnce(new Error('sin red'));
    await expect(registerPushToken()).resolves.toBeUndefined();
    expect(updateDeviceMock).not.toHaveBeenCalled();

    updateDeviceMock.mockResolvedValueOnce({
      error: { error: { code: 'internal_error', message: 'x' } },
      response: new Response(null, { status: 500 }),
    });
    await expect(registerPushToken()).resolves.toBeUndefined();
    expect(updateDeviceMock).toHaveBeenCalledTimes(1);

    await registerPushToken();
    expect(updateDeviceMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('ExponentPushToken');
  });
});

describe('startPushTokenSync', () => {
  it('cada vez que el sistema rota el token, vuelve a registrar; y se puede cancelar', async () => {
    const remove = jest.fn();
    let onToken: () => void = () => undefined;
    notifications.addPushTokenListener.mockImplementation((listener) => {
      onToken = listener as () => void;
      return { remove };
    });
    const stop = startPushTokenSync();
    notifications.getExpoPushTokenAsync.mockResolvedValue({
      type: 'expo',
      data: 'ExponentPushToken[rotado]',
    });
    onToken();
    await new Promise((resolve) => setImmediate(resolve));
    expect(updateDeviceMock).toHaveBeenCalledWith({
      body: { pushToken: 'ExponentPushToken[rotado]' },
    });
    stop();
    expect(remove).toHaveBeenCalled();
  });
});
