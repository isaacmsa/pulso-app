import PowerMonitor from '../../../../modules/power-monitor';
import { nativeDiagnosticsSchema } from '../native-schema';
import {
  configureApi,
  getLastServerStatus,
  getToken,
  isTokenInvalid,
  PowerMonitorError,
  readEvents,
  storeToken,
} from '../power-monitor';

jest.mock('../../../../modules/power-monitor', () => ({
  __esModule: true,
  default: {
    getEvents: jest.fn(),
    recordSnapshot: jest.fn(),
    storeToken: jest.fn(),
    getToken: jest.fn(),
    isTokenInvalid: jest.fn(),
    configureApi: jest.fn(),
    getLastServerStatus: jest.fn(),
  },
}));
const native = PowerMonitor as jest.Mocked<typeof PowerMonitor>;

const valid = {
  kind: 'snapshot',
  id: '0192f3a4-5b6c-7d8e-9f01-23456789abcd',
  at: 1_793_570_400_000,
  source: 'heartbeat',
  plugged: true,
  onWifi: true,
  homeWifi: null,
  internet: true,
  interactive: false,
  batteryPct: 80,
};

it('separa eventos inválidos sin romper', async () => {
  native.getEvents.mockResolvedValue(
    JSON.stringify([valid, { ...valid, batteryPct: -1 }, { ...valid, source: 'nuevo' }]),
  );
  await expect(readEvents(0)).resolves.toEqual({ events: [valid], invalid: 2 });
});

it('falla con bad_json si el nativo devuelve algo que no es JSON', async () => {
  native.getEvents.mockResolvedValue('no-json');
  await expect(readEvents(0)).rejects.toMatchObject({ code: 'bad_json' });
  await expect(readEvents(0)).rejects.toBeInstanceOf(PowerMonitorError);
});

it('valida el diagnóstico del nativo', () => {
  const diagnostics = {
    appVersion: '0.1.0',
    manufacturer: 'Xiaomi',
    model: '25028RN03L',
    sdkInt: 35,
    standbyBucket: 10,
    ignoringBatteryOptimizations: true,
    pendingEvents: 3,
    storedEvents: 3,
    rejectedEvents: 0,
    homeNetworkLearned: true,
    armed: { networkCallback: false, heartbeat: true, chargingJob: true, foregroundService: false },
  };
  expect(nativeDiagnosticsSchema.safeParse(diagnostics).success).toBe(true);
  const { armed: _armed, ...withoutArmed } = diagnostics;
  expect(nativeDiagnosticsSchema.safeParse(withoutArmed).success).toBe(false);
});

it('getToken devuelve null cuando el nativo no tiene token', async () => {
  native.getToken.mockResolvedValue(null);
  await expect(getToken()).resolves.toBeNull();
});

it('getToken devuelve el token que da el nativo', async () => {
  native.getToken.mockResolvedValue('tok_abc');
  await expect(getToken()).resolves.toBe('tok_abc');
});

it('storeToken, isTokenInvalid y configureApi pasan al nativo', async () => {
  native.storeToken.mockResolvedValue(undefined);
  native.isTokenInvalid.mockResolvedValue(true);
  native.configureApi.mockResolvedValue(undefined);
  await storeToken('tok_abc');
  await expect(isTokenInvalid()).resolves.toBe(true);
  await configureApi('https://api.example.test');
  expect(native.storeToken).toHaveBeenCalledWith('tok_abc');
  expect(native.configureApi).toHaveBeenCalledWith('https://api.example.test');
});

describe('getLastServerStatus', () => {
  const status = {
    state: 'sin_luz',
    since: 1_793_570_400_000,
    alias: 'Casa',
    openOutageStart: 1_793_570_400_000,
  };
  const receivedAt = 1_793_570_500_000;

  it('devuelve null si el nativo no tiene estado guardado', async () => {
    native.getLastServerStatus.mockResolvedValue(null);
    await expect(getLastServerStatus()).resolves.toBeNull();
  });

  it('devuelve el estado validado con zHomeStatus y la hora en que llegó', async () => {
    native.getLastServerStatus.mockResolvedValue(
      JSON.stringify({ status: { ...status, nuevo: 1 }, receivedAt }),
    );
    await expect(getLastServerStatus()).resolves.toEqual({ status, receivedAt });
  });

  it('devuelve null si el estado no cumple el esquema o no es JSON', async () => {
    native.getLastServerStatus.mockResolvedValue(
      JSON.stringify({ status: { ...status, state: 'nuevo' }, receivedAt }),
    );
    await expect(getLastServerStatus()).resolves.toBeNull();
    native.getLastServerStatus.mockResolvedValue('no-json');
    await expect(getLastServerStatus()).resolves.toBeNull();
  });

  it('devuelve null con el formato viejo, sin receivedAt', async () => {
    native.getLastServerStatus.mockResolvedValue(JSON.stringify(status));
    await expect(getLastServerStatus()).resolves.toBeNull();
    native.getLastServerStatus.mockResolvedValue(JSON.stringify({ status }));
    await expect(getLastServerStatus()).resolves.toBeNull();
  });

  it('devuelve null si receivedAt no es un entero positivo', async () => {
    for (const bad of [0, -5, 1.5, '1793570500000']) {
      native.getLastServerStatus.mockResolvedValue(JSON.stringify({ status, receivedAt: bad }));
      await expect(getLastServerStatus()).resolves.toBeNull();
    }
  });
});
