import { NativeModule, requireNativeModule } from 'expo';

declare class PowerMonitorModule extends NativeModule<Record<string, never>> {
  /** Lee, guarda y devuelve un snapshot como JSON. */
  recordSnapshot(source: string): Promise<string>;
  /** Arma los mecanismos de detección (idempotente). */
  arm(): Promise<void>;
  /** Activa o apaga el servicio en primer plano (mecanismo D, experimental). */
  setForegroundServiceEnabled(enabled: boolean): Promise<void>;
  /** Guarda un reporte manual ("hay_luz" | "fluctuando" | "sin_luz") y lo devuelve como JSON. */
  recordReport(value: string): Promise<string>;
  /** Aprende la huella de la red Wi-Fi actual como "la de casa". */
  learnHomeNetwork(): Promise<boolean>;
  /** Diagnóstico del registrador como JSON. */
  getDiagnostics(): Promise<string>;
  /** Escribe el exporte del registrador en el caché y devuelve su URI file://. */
  exportEvents(): Promise<string>;
  /** Eventos guardados desde `sinceMs`, del más nuevo al más viejo, como un arreglo JSON. */
  getEvents(sinceMs: number): Promise<string>;
}

export default requireNativeModule<PowerMonitorModule>('PowerMonitor');
