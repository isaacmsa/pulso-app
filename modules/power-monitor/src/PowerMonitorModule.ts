import { NativeModule, requireNativeModule } from 'expo';

declare class PowerMonitorModule extends NativeModule<Record<string, never>> {
  /** Lee, guarda y devuelve un snapshot como JSON. */
  recordSnapshot(source: string): Promise<string>;
  /** Eventos guardados desde `sinceMs`, del más nuevo al más viejo, como un arreglo JSON. */
  getEvents(sinceMs: number): Promise<string>;
}

export default requireNativeModule<PowerMonitorModule>('PowerMonitor');
