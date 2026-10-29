import { detectionRisk, type RiskDiagnostics } from '../detection-risk';

const NOW = 1_793_570_400_000;
const MIN = 60_000;

const ok: RiskDiagnostics = {
  standbyBucket: 10,
  ignoringBatteryOptimizations: true,
  manufacturer: 'Google',
};

describe('detectionRisk', () => {
  it('todo bien no muestra nada', () => {
    expect(detectionRisk(ok, NOW - 10 * MIN, NOW)).toBeNull();
  });

  it('bucket 40 (rare) es riesgo', () => {
    expect(detectionRisk({ ...ok, standbyBucket: 40 }, NOW, NOW)).toBe('standby_bucket');
  });

  it('bucket 45 (restricted) es riesgo', () => {
    expect(detectionRisk({ ...ok, standbyBucket: 45 }, NOW, NOW)).toBe('standby_bucket');
  });

  it('bucket 30 (frequent) o desconocido no es riesgo', () => {
    expect(detectionRisk({ ...ok, standbyBucket: 30 }, NOW, NOW)).toBeNull();
    expect(detectionRisk({ ...ok, standbyBucket: null }, NOW, NOW)).toBeNull();
  });

  it('latido de hace 41 min es riesgo y de hace 40 min no', () => {
    expect(detectionRisk(ok, NOW - 41 * MIN, NOW)).toBe('stale_heartbeat');
    expect(detectionRisk(ok, NOW - 40 * MIN, NOW)).toBeNull();
  });

  it('sin snapshots no se puede decir que el latido esté viejo', () => {
    expect(detectionRisk(ok, null, NOW)).toBeNull();
  });

  it.each(['Xiaomi', 'REDMI', 'poco', 'Samsung', 'TECNO', 'Infinix'])(
    '%s sin exención es riesgo',
    (manufacturer) => {
      expect(
        detectionRisk({ ...ok, manufacturer, ignoringBatteryOptimizations: false }, NOW, NOW),
      ).toBe('battery_optimization');
    },
  );

  it('un fabricante fuera de la lista sin exención no es riesgo', () => {
    expect(
      detectionRisk(
        { ...ok, manufacturer: 'Google', ignoringBatteryOptimizations: false },
        NOW,
        NOW,
      ),
    ).toBeNull();
  });

  it('Xiaomi con exención no es riesgo', () => {
    expect(detectionRisk({ ...ok, manufacturer: 'Xiaomi' }, NOW, NOW)).toBeNull();
  });
});
