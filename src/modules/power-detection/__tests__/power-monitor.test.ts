import PowerMonitor from '../../../../modules/power-monitor';
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
