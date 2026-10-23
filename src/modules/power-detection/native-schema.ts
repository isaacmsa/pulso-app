import { z } from 'zod';
import {
  zConfirmationEvent,
  zDeviceEvent,
  zDiagnostics,
  zReportEvent,
  zSnapshotEvent,
} from '../../shared/api/generated/zod.gen';

// Contrato puente Kotlin → JS. Los eventos son los mismos que viajan a la API, así que se validan con el
// esquema generado desde openapi.json (D-023); estos nombres quedan para no tocar a quien los usa.
export const nativeSnapshotSchema = zSnapshotEvent;
export const nativeReportSchema = zReportEvent;
export const nativeConfirmationSchema = zConfirmationEvent;
export const nativeEventSchema = zDeviceEvent;

export type NativeSnapshot = z.infer<typeof nativeSnapshotSchema>;
export type NativeEvent = z.infer<typeof nativeEventSchema>;

// El diagnóstico del lote más el estado del registrador, que solo ve la pantalla de registro y el exporte
// (`nativeDiagnosticsSchema` de pulso-api/src/domain/spike/schema.ts).
export const nativeDiagnosticsSchema = zDiagnostics.extend({
  storedEvents: z.int().gte(0),
  rejectedEvents: z.int().gte(0),
  homeNetworkLearned: z.boolean(),
  armed: z.object({
    networkCallback: z.boolean(),
    heartbeat: z.boolean(),
    chargingJob: z.boolean(),
    foregroundService: z.boolean(),
  }),
});

export type NativeDiagnostics = z.infer<typeof nativeDiagnosticsSchema>;
export type ReportValue = z.infer<typeof nativeReportSchema>['value'];
