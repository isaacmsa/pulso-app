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
  /** Si el usuario dejó encendido el servicio en primer plano (la intención, no si corre ahora). */
  isForegroundServiceEnabled(): Promise<boolean>;
  /** Eventos guardados desde `sinceMs`, del más nuevo al más viejo, como un arreglo JSON. */
  getEvents(sinceMs: number): Promise<string>;
  /** Guarda el token del dispositivo en la bóveda nativa (Android Keystore). Reemplaza el anterior y limpia la marca de inválido. */
  storeToken(token: string): Promise<void>;
  /** Token del dispositivo, o null si no hay o el Keystore no puede leerlo. */
  getToken(): Promise<string | null>;
  /** Si el servidor rechazó el token y hay que registrar de nuevo. */
  isTokenInvalid(): Promise<boolean>;
  /** `{ status: HomeStatus, receivedAt }` de la última subida aceptada, como JSON sin validar, o null. */
  getLastServerStatus(): Promise<string | null>;
  /** Guarda lo que eligió la persona: "watch" (vigila su casa) o "follow" (solo sigue una). "follow" nunca arma ni sube, y al guardarlo desarma lo que hubiera armado. */
  setRole(role: string): Promise<void>;
  /** El rol guardado, o null si todavía no eligió. */
  getRole(): Promise<string | null>;
  /** Guarda qué paso del onboarding falta ("role" | "notifications" | "battery" | "home"); null lo da por terminado. */
  setOnboardingStep(step: string | null): Promise<void>;
  /** El paso pendiente del onboarding, o null si no hay (terminado, o un teléfono registrado antes de esta marca). */
  getOnboardingStep(): Promise<string | null>;
  /** Encola ya la subida de lo pendiente. No hace nada en un teléfono "follow". */
  requestUpload(): Promise<void>;
  /** Abre la pantalla del fabricante para "autostart" (Inicio automático) o "battery". Devuelve si se abrió alguna. */
  openBatterySettings(kind: string): Promise<boolean>;
  /** Guarda la URL base de la API para la subida en segundo plano (la versión de la app la pone el nativo). */
  configureApi(apiUrl: string): Promise<void>;
}

export default requireNativeModule<PowerMonitorModule>('PowerMonitor');
