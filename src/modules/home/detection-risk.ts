import { isRiskManufacturer, isXiaomiFamily } from '../onboarding/battery-guide';
import type { NativeDiagnostics } from '../power-detection/native-schema';

/** Ruta de la guía de batería para teléfonos con sesión (las de `onboarding/*` solo existen en el onboarding). */
export const BATTERY_GUIDE_ROUTE = '/battery-guide';

export type RiskDiagnostics = Pick<
  NativeDiagnostics,
  'standbyBucket' | 'ignoringBatteryOptimizations' | 'manufacturer'
>;

export type RiskReason = 'standby_bucket' | 'battery_optimization' | 'stale_heartbeat';

/** Android pasa a `rare` (40) o `restricted` (45) a las apps que nadie abre: sus trabajos se retrasan horas. */
const RARE_BUCKET = 40;
/** El latido corre cada ~15 min; con más de 40 min de silencio algo lo está frenando. */
const STALE_HEARTBEAT_MS = 40 * 60_000;

/**
 * Por qué la detección de este teléfono está en riesgo, o null si todo va bien. Sin diagnóstico (todavía no
 * cargó) solo se mira el latido; sin snapshots no hay latido que juzgar.
 */
export function detectionRisk(
  diagnostics: RiskDiagnostics | null,
  lastSnapshotAt: number | null,
  now: number,
): RiskReason | null {
  if (diagnostics) {
    if (diagnostics.standbyBucket !== null && diagnostics.standbyBucket >= RARE_BUCKET) {
      return 'standby_bucket';
    }
    // En MIUI «Sin restricciones» deja `isIgnoringBatteryOptimizations` en false (medido, docs/detection.md):
    // ahí ese campo no dice nada y solo cuentan el bucket y el latido.
    if (
      !diagnostics.ignoringBatteryOptimizations &&
      isRiskManufacturer(diagnostics.manufacturer) &&
      !isXiaomiFamily(diagnostics.manufacturer)
    ) {
      return 'battery_optimization';
    }
  }
  if (lastSnapshotAt !== null && now - lastSnapshotAt > STALE_HEARTBEAT_MS) {
    return 'stale_heartbeat';
  }
  return null;
}
