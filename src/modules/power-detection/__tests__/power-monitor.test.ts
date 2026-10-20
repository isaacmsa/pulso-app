import PowerMonitor from '../../../../modules/power-monitor';
import { nativeDiagnosticsSchema } from '../native-schema';
import { PowerMonitorError, readEvents } from '../power-monitor';

jest.mock('../../../../modules/power-monitor', () => ({
  __esModule: true,
  default: { getEvents: jest.fn(), recordSnapshot: jest.fn() },
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
    homeNetworkLearned: true,
    armed: { networkCallback: false, heartbeat: true, chargingJob: true, foregroundService: false },
  };
  expect(nativeDiagnosticsSchema.safeParse(diagnostics).success).toBe(true);
  const { armed: _armed, ...withoutArmed } = diagnostics;
  expect(nativeDiagnosticsSchema.safeParse(withoutArmed).success).toBe(false);
});
