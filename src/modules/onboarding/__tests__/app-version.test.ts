import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateDevice } from '../../../shared/api/generated';
import { REPORTED_VERSION_KEY, reportAppVersion } from '../app-version';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '0.2.0' } },
}));
jest.mock('../../../shared/api/generated', () => ({ updateDevice: jest.fn() }));

const ok = { data: undefined, error: undefined, response: { status: 204 } };

beforeEach(async () => {
  await AsyncStorage.clear();
  (updateDevice as jest.Mock).mockReset().mockResolvedValue(ok);
});

describe('reportAppVersion', () => {
  it('después de actualizar la app, manda la versión nueva una vez', async () => {
    await AsyncStorage.setItem(REPORTED_VERSION_KEY, '0.1.0');
    await reportAppVersion();
    await reportAppVersion();
    expect(updateDevice).toHaveBeenCalledTimes(1);
    expect(updateDevice).toHaveBeenCalledWith({ body: { appVersion: '0.2.0' } });
    await expect(AsyncStorage.getItem(REPORTED_VERSION_KEY)).resolves.toBe('0.2.0');
  });

  it('sin versión anotada (instalaciones de la 0.1) también la manda', async () => {
    await reportAppVersion();
    expect(updateDevice).toHaveBeenCalledWith({ body: { appVersion: '0.2.0' } });
  });

  it('si el servidor falla no la anota, para reintentar en el próximo arranque, y no lanza', async () => {
    (updateDevice as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    await expect(reportAppVersion()).resolves.toBeUndefined();
    await expect(AsyncStorage.getItem(REPORTED_VERSION_KEY)).resolves.toBeNull();
  });
});
