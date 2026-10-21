# Fase 0 · Registrador: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`). Casi todas las tareas necesitan el Xiaomi físico y las manos de Isaac, así que se ejecutan en la sesión principal, no en subagentes.

**Objetivo:** que el Xiaomi y otros 2 o más teléfonos registren snapshots reales con los cuatro mecanismos de detección desde la semana 2, y exporten un archivo que `pulso-api` pueda analizar.

**Arquitectura:** app Expo SDK 58 en la raíz del repo, con un módulo local en Kotlin (`modules/power-monitor`) que lee, guarda y exporta eventos sin depender del JS. En esta fase no hay API: nada sale del teléfono salvo el exporte manual. El clasificador y el análisis viven en `pulso-api` (D-016, A-007), que tiene su propio plan de fase 0.

**Stack:** Node 24, pnpm 12.14, TypeScript estricto, Expo SDK 58 (React Native 0.88, React 19.3), Expo Modules API en Kotlin, WorkManager, JobScheduler, Zod 4, jest-expo y Biome.

**Spec:** `docs/detection.md` (señales, mecanismos, prueba técnica, permisos), `pulso-api/docs/api.md` (forma de los eventos), `pulso-api/src/domain/spike/schema.ts` (formato del exporte), `docs/decisions.md` (D-002, D-003, D-004, D-008, D-010, D-016).

## Restricciones globales

- `packageManager: "pnpm@12.14.0"`, `engines.node: ">=24"` y `.npmrc` con `node-linker=hoisted`.
- Módulos de Expo siempre con `npx expo install`: expo ~58.0.16, react-native 0.88.0, react 19.3.0 (D-002).
- `compileSdkVersion` 37 y `targetSdkVersion` 36 con `expo-build-properties` (los módulos de SDK 58 exigen compilar contra 37). `android/` no se versiona (CNG).
- Paquete Android `com.isaacmendoza.pulso`, nombre "Pulso", scheme `pulso` (D-010).
- Todas las horas son epoch ms (`number` / `Long`). En la pantalla se muestran en hora de Caracas (UTC−4 fijo).
- En el nativo: seguimiento de transición a 90 000 ms, latido de 15 min, retención local de 14 días.
- Los campos del evento son exactamente los de `pulso-api/docs/api.md`: `kind, id, at, source, plugged, onWifi, homeWifi, internet, interactive, batteryPct` / `kind, id, at, value` / `kind, id, at, outageStart, answer`.
- `homeWifi` es `null` solo si no hay huella aprendida; con huella y sin Wi-Fi es `false`.
- Permisos permitidos: `ACCESS_NETWORK_STATE`, `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_SPECIAL_USE`. Ninguno de ubicación.
- Kotlin: paquete `expo.modules.powermonitor`, módulo `Name("PowerMonitor")` y tag de log `PowerMonitor`.
- Código e identificadores en inglés; textos de la interfaz en español venezolano llano; documentación en español.
- Commits en Conventional Commits. Al cerrar una tarea, marcar su línea en `docs/roadmap.md` en el mismo commit.

## Foco de revisión

1. **El nativo devuelve un evento malformado** (`batteryPct: -1`, una fuente nueva): la pantalla de registro no se cae y cuenta los inválidos. Lo cubre el test "separa eventos inválidos sin romper" (tarea 2).
2. **`homeWifi` null serializado como clave ausente**: `JSONObject.put(key, null)` borra la clave y el backend rechazaría el evento. Lo cubre el test "homeWifi null se serializa como null, no se omite" (tarea 2).
3. **Teléfono conectado por USB** durante la verificación: siempre se ve `plugged: true` y la prueba no vale. Las verificaciones de las tareas 3 y 4 exigen depuración inalámbrica como primer paso.
4. **Reinicio del teléfono**: los mecanismos se re-arman solos y aparece un snapshot `boot`. Lo cubre la verificación con `adb reboot` (tareas 3 y 4).
5. **El seguimiento de transición se programa en cada snapshot**, y no solo al desenchufar: llenaría la cola de trabajos. Lo cubre el test "programa el seguimiento solo al pasar de enchufado a desenchufado" (tarea 3).

---

## Estructura de archivos

```text
app.json · package.json · tsconfig.json · jest.config.js · biome.json · .npmrc · .gitignore
.github/workflows/ci.yml
app/_layout.tsx · app/index.tsx · app/debug.tsx
__tests__/home.test.tsx                 # fuera de app/: Expo Router no lo toma como ruta
src/modules/power-detection/
  native-schema.ts                      # contrato puente Kotlin → JS (se reemplaza en la fase 1)
  power-monitor.ts
  __tests__/power-monitor.test.ts · __tests__/debug-screen.test.tsx
modules/power-monitor/
  expo-module.config.json · index.ts · src/PowerMonitor.types.ts
  android/build.gradle
  android/src/main/AndroidManifest.xml
  android/src/main/java/expo/modules/powermonitor/
    PowerMonitorModule.kt · SnapshotReader.kt · SnapshotRecorder.kt · EventStore.kt
    EventJson.kt · UuidV7.kt · Arming.kt · NetworkWatch.kt · NetworkEventReceiver.kt
    HeartbeatWorker.kt · TransitionCheckWorker.kt · BootReceiver.kt
    ChargingJobService.kt · PowerWatchService.kt · HomeNetwork.kt · Diagnostics.kt · Exporter.kt
  android/src/test/java/expo/modules/powermonitor/
    UuidV7Test.kt · EventJsonTest.kt · SnapshotRecorderTest.kt · HomeNetworkTest.kt
docs/registrador.md                     # instrucciones para la familia (tarea 6)
```

---

### Tarea 1: Repo y app Expo en el Xiaomi

**Archivos:**
- Crear con la plantilla: `app.json`, `package.json`, `tsconfig.json`
- Crear: `.gitignore`, `biome.json`, `.github/workflows/ci.yml`, `app/_layout.tsx`, `app/index.tsx`, `jest.config.js`, `__tests__/home.test.tsx`. Los tests nunca van dentro de `app/`, porque Expo Router trataría cada archivo como una ruta

**Interfaces:**
- Produce: paquete `pulso-app` con los scripts:
  - `android` (`expo run:android --device`) y `android:release` (`expo run:android --variant release --device`)
  - `lint` (`biome check .`), `typecheck` (`tsc --noEmit`) y `test` (`jest`)

- [ ] **Paso 1:** Crear el proyecto en una carpeta temporal y traer su contenido a la raíz del repo sin pisar `docs/`, `AGENTS.md`, `CLAUDE.md` ni `README.md`:
  - `npx create-expo-app@latest /tmp/pulso-expo --template blank-typescript@sdk-58 --no-install` (si el flag cambió, ver `npx create-expo-app --help`)
  - `rsync -a --ignore-existing /tmp/pulso-expo/ ./`
  - `git init`
- [ ] **Paso 2:** `pnpm install` y luego `npx expo install expo-router expo-linking expo-constants expo-status-bar react-native-safe-area-context react-native-screens expo-dev-client expo-build-properties zod`. Dependencias de desarrollo: `npx expo install -- --save-dev jest-expo jest @testing-library/react-native @types/jest @biomejs/biome`.
- [ ] **Paso 3:** Configurar:
  - `app.json`: `name` "Pulso", `slug` "pulso", `scheme` "pulso", `userInterfaceStyle` "dark", `android.package` "com.isaacmendoza.pulso" y plugins `expo-router` y `["expo-build-properties", { "android": { "compileSdkVersion": 37, "targetSdkVersion": 36 } }]`
  - `package.json`: `"main": "expo-router/entry"`, `"packageManager": "pnpm@12.14.0"` y `"engines": { "node": ">=24" }`. Agregar `.npmrc` con `node-linker=hoisted`
  - `jest.config.js` con el preset `jest-expo`
  - `.gitignore`: `node_modules`, `.expo`, `android`, `ios`, `*.apk`, `*.aab`, `exports/` y `.DS_Store`
  - `biome.json`: recomendado, comillas simples, 2 espacios, ancho 100, ignorando `android`, `ios` y `.expo`
- [ ] **Paso 4: Escribir el test que falla**

```tsx
// __tests__/home.test.tsx
import { render, screen } from '@testing-library/react-native';
import Home from '../app/index';

it('muestra el nombre de la app y el acceso al registrador', () => {
  render(<Home />);
  expect(screen.getByText('Pulso')).toBeTruthy();
  expect(screen.getByText('Abrir registrador')).toBeTruthy();
});
```

- [ ] **Paso 5:** `pnpm test`. Esperado: FALLA porque no existe `../app/index`.
- [ ] **Paso 6:** `app/index.tsx` muestra "Pulso" y un `Link` "Abrir registrador" a `/debug`. `_layout.tsx` es un `Stack` con fondo oscuro.
- [ ] **Paso 7:** `pnpm lint && pnpm typecheck && pnpm test`. Esperado: PASA.
- [ ] **Paso 8:** Preparar el Xiaomi (Isaac): opciones de desarrollador, depuración USB, "Instalar vía USB" (pide cuenta Mi y SIM) y depuración inalámbrica. `adb devices` lo muestra.
- [ ] **Paso 9:** `pnpm android`. Esperado: la app abre en el Xiaomi con "Pulso".
- [ ] **Paso 10:** `grep -E "targetSdkVersion|compileSdkVersion" android/gradle.properties`. Esperado: `compileSdkVersion=37` y `targetSdkVersion=36`.
- [ ] **Paso 11:** `ci.yml` con `pnpm/action-setup`, `actions/setup-node` (Node 24, caché de pnpm), `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` y `pnpm test`. Preguntar a Isaac la visibilidad del repo `pulso-app`, crearlo con `gh repo create` y hacer push. Esperado: el CI en verde.
- [ ] **Paso 12:** Commit `feat: app expo sdk 58 en el xiaomi con ci`

### Tarea 2: Módulo `power-monitor`: snapshot, almacén y envoltorio JS

**Archivos:**
- Crear con `npx create-expo-module@latest --local power-monitor`: `modules/power-monitor/`. Dejar `"platforms": ["android"]` en `expo-module.config.json` y borrar `ios/`.
- Crear: `src/modules/power-detection/native-schema.ts`, `PowerMonitorModule.kt`, `SnapshotReader.kt`, `SnapshotRecorder.kt`, `EventStore.kt`, `EventJson.kt`, `UuidV7.kt`, `UuidV7Test.kt`, `EventJsonTest.kt`, `src/PowerMonitor.types.ts`, `index.ts`
- Crear: `src/modules/power-detection/power-monitor.ts`, `__tests__/power-monitor.test.ts`, `app/debug.tsx`
- Modificar: `modules/power-monitor/android/build.gradle` (`testImplementation 'junit:junit:4.13.2'` y `testImplementation 'org.json:json:20240303'`, porque el `org.json` de `android.jar` no funciona en tests de JVM)

**Interfaces:**
- Kotlin:
  - `object UuidV7 { fun generate(nowMs: Long = System.currentTimeMillis(), random: java.util.Random = java.security.SecureRandom()): String }`
  - `data class Snapshot(val id: String, val at: Long, val source: String, val plugged: Boolean, val onWifi: Boolean, val homeWifi: Boolean?, val internet: Boolean?, val interactive: Boolean?, val batteryPct: Int?)`
  - `data class Report(val id: String, val at: Long, val value: String)`
  - `object EventJson { fun snapshot(s: Snapshot): String; fun report(r: Report): String }`
  - `object SnapshotReader { fun read(context: Context, source: String): Snapshot }` (`homeWifi = null` hasta la tarea 5)
  - `class EventStore private constructor(context: Context) { fun insert(id: String, at: Long, kind: String, json: String); fun since(sinceMs: Long, limit: Int = 500): List<String>; fun count(): Int; fun lastSnapshotJson(): String?; companion object { const val RETENTION_MS = 1_209_600_000L; fun get(context: Context): EventStore } }`. Tabla `events(id TEXT PRIMARY KEY, at INTEGER NOT NULL, kind TEXT NOT NULL, json TEXT NOT NULL, uploaded INTEGER NOT NULL DEFAULT 0)` con índice en `at`. Cada `insert` poda lo que tenga más de `RETENTION_MS`.
  - `object SnapshotRecorder { fun record(context: Context, source: String): Snapshot }` (leer, serializar, guardar y loguear con el tag `PowerMonitor`)
- Módulo expuesto a JS: `recordSnapshot(source: string): Promise<string>` y `getEvents(sinceMs: number): Promise<string>` (JSON de un arreglo). Los eventos viajan como JSON para que lo que ve la app sea exactamente lo que se subirá.
- JS, `native-schema.ts`: `nativeEventSchema` (unión discriminada por `kind` con los mismos campos que `deviceEventSchema` de `pulso-api/docs/api.md`) y los tipos `NativeEvent` y `NativeSnapshot`. Es el contrato puente entre Kotlin y JS, y en la fase 1 se reemplaza por el esquema generado desde `openapi.json`.
- JS, `power-monitor.ts`: `readEvents(sinceMs: number): Promise<{ events: NativeEvent[]; invalid: number }>`, `recordAppOpen(): Promise<NativeSnapshot>` y `class PowerMonitorError extends Error { code: 'bad_json' | 'invalid_event' }`.

- [ ] **Paso 1: Escribir los tests de Kotlin que fallan**
  - `UuidV7Test`:
    - "tiene versión 7 y variante RFC": el carácter 14 es `'7'` y el 19 está en `[89ab]`.
    - "los primeros 12 hex son el timestamp": `generate(0x0192F3A45B6CL)` empieza con `0192f3a4-5b6c-7`.
    - "dos ids en el mismo ms son distintos".
  - `EventJsonTest`:
    - "serializa todas las claves del snapshot": las claves son exactamente `kind, id, at, source, plugged, onWifi, homeWifi, internet, interactive, batteryPct`, y `kind` vale `"snapshot"`.
    - "homeWifi null se serializa como null, no se omite": `JSONObject(json).isNull("homeWifi")` es `true` y `has("homeWifi")` es `true`. Usar `JSONObject.NULL`, porque `put(key, null)` borra la clave.
- [ ] **Paso 2:** `pnpm exec expo prebuild --platform android` y luego `cd android && ./gradlew :power-monitor:testDebugUnitTest` (si el nombre del proyecto Gradle es otro, verlo con `./gradlew projects`). Esperado: FALLA de compilación porque no existen `UuidV7` ni `EventJson`.
- [ ] **Paso 3:** Implementar `UuidV7` y `EventJson`, y ejecutar el comando del paso 2. Esperado: `BUILD SUCCESSFUL` con 5 tests.
- [ ] **Paso 4:** Implementar `SnapshotReader`:
  - `plugged` sale del broadcast fijo (`EXTRA_PLUGGED != 0`) y `batteryPct` de `EXTRA_LEVEL * 100 / EXTRA_SCALE`, o `null` si falta.
  - `onWifi` e `internet` se calculan recorriendo `connectivityManager.allNetworks` (deprecado, pero es la única forma de ver un Wi-Fi que no es la red por defecto) buscando `TRANSPORT_WIFI` y `NET_CAPABILITY_VALIDATED`.
  - `interactive` sale de `PowerManager.isInteractive`.
  - Después implementar `EventStore`, `SnapshotRecorder` y `PowerMonitorModule` (`recordSnapshot` y `getEvents`).
- [ ] **Paso 5: Escribir el test de JS que falla**

```ts
// src/modules/power-detection/__tests__/power-monitor.test.ts
import PowerMonitor from '../../../../modules/power-monitor';
import { readEvents, PowerMonitorError } from '../power-monitor';

jest.mock('../../../../modules/power-monitor', () => ({ __esModule: true, default: { getEvents: jest.fn(), recordSnapshot: jest.fn() } }));
const native = PowerMonitor as jest.Mocked<typeof PowerMonitor>;

const valid = {
  kind: 'snapshot', id: '0192f3a4-5b6c-7d8e-9f01-23456789abcd', at: 1_793_570_400_000, source: 'heartbeat',
  plugged: true, onWifi: true, homeWifi: null, internet: true, interactive: false, batteryPct: 80,
};

it('separa eventos inválidos sin romper', async () => {
  native.getEvents.mockResolvedValue(JSON.stringify([valid, { ...valid, batteryPct: -1 }, { ...valid, source: 'nuevo' }]));
  await expect(readEvents(0)).resolves.toEqual({ events: [valid], invalid: 2 });
});

it('falla con bad_json si el nativo devuelve algo que no es JSON', async () => {
  native.getEvents.mockResolvedValue('no-json');
  await expect(readEvents(0)).rejects.toMatchObject({ code: 'bad_json' });
  await expect(readEvents(0)).rejects.toBeInstanceOf(PowerMonitorError);
});
```

- [ ] **Paso 6:** `pnpm test power-monitor`. Esperado: FALLA porque no existe `../power-monitor`.
- [ ] **Paso 7:** Implementar `power-monitor.ts`: `readEvents` hace `JSON.parse` y luego `nativeEventSchema.safeParse` evento por evento. `recordAppOpen` llama a `recordSnapshot('app_open')` y lanza `invalid_event` si no valida. Después, `app/debug.tsx`: un `FlatList` con los últimos 50 eventos (hora de Caracas, fuente, ⚡ corriente, 📶 Wi-Fi), los contadores "guardados" e "inválidos", y el botón "Registrar ahora".
- [ ] **Paso 8:** `pnpm test`. Esperado: PASA.
- [ ] **Paso 9: Verificar en el Xiaomi.** `pnpm android`, abrir `pulso://debug` (`adb shell am start -a android.intent.action.VIEW -d "pulso://debug"`) y tocar "Registrar ahora". Esperado: un evento `app_open` con corriente y Wi-Fi. Luego `adb shell dumpsys battery unplug`, tocar de nuevo (esperado: corriente apagada) y `adb shell dumpsys battery reset`. Esperado: 0 inválidos.
- [ ] **Paso 10:** Commit `feat(power-monitor): snapshot, almacén local y envoltorio validado`

### Tarea 3: Mecanismos A y B, arranque y seguimiento de transición

**Archivos:**
- Crear: `Arming.kt`, `NetworkWatch.kt`, `NetworkEventReceiver.kt`, `HeartbeatWorker.kt`, `TransitionCheckWorker.kt`, `BootReceiver.kt`, `SnapshotRecorderTest.kt`
- Modificar: `SnapshotRecorder.kt`, `PowerMonitorModule.kt` (`arm`), `android/src/main/AndroidManifest.xml` (`BootReceiver` con `BOOT_COMPLETED` y `MY_PACKAGE_REPLACED`, y `NetworkEventReceiver`, ambos con `exported=false`: los broadcasts del sistema y los `PendingIntent` propios llegan igual, permisos `ACCESS_NETWORK_STATE` y `RECEIVE_BOOT_COMPLETED`), `android/build.gradle` (`androidx.work:work-runtime-ktx` en su última versión estable), `app/_layout.tsx` y `power-monitor.ts` (`arm()`)

**Interfaces:**
- Kotlin:
  - `object Arming { fun ensureArmed(context: Context) }`. Es idempotente: registra A, encola B con `enqueueUniquePeriodicWork("heartbeat", KEEP)` y guarda en SharedPreferences `armed.networkCallback` y `armed.heartbeat`.
  - `NetworkWatch.register(context)` registra dos `NetworkRequest`: Wi-Fi (`addTransportType(TRANSPORT_WIFI)`) e internet (`addCapability(NET_CAPABILITY_INTERNET)`). Cada uno con su `PendingIntent.getBroadcast`, `FLAG_UPDATE_CURRENT or FLAG_MUTABLE` (el sistema le agrega extras, así que debe ser mutable) y los códigos de petición 1 y 2.
  - `NetworkEventReceiver` usa `goAsync()` y llama a `SnapshotRecorder.record(ctx, "network_callback")`. `HeartbeatWorker` graba `"heartbeat"`, `TransitionCheckWorker` graba `"transition_check"` y `BootReceiver` graba `"boot"` y llama a `Arming.ensureArmed`.
  - `SnapshotRecorder.shouldScheduleTransitionCheck(prevPlugged: Boolean?, nowPlugged: Boolean): Boolean` devuelve `true` solo si `prevPlugged == true && !nowPlugged`. En ese caso `record` encola `TransitionCheckWorker` con 90 s de retraso, como trabajo único `"transition_check"` con `REPLACE`.
- JS: `arm(): Promise<void>`. `_layout.tsx` llama a `arm()` y a `recordAppOpen()` al montar.

- [ ] **Paso 1: Escribir el test que falla.** `SnapshotRecorderTest`:
  - "programa el seguimiento solo al pasar de enchufado a desenchufado": `(true, false)` da `true`; `(false, false)`, `(true, true)`, `(null, false)` y `(false, true)` dan `false`.
- [ ] **Paso 2:** `./gradlew :power-monitor:testDebugUnitTest`. Esperado: FALLA de compilación.
- [ ] **Paso 3:** Implementar todo lo de la lista de interfaces.
- [ ] **Paso 4:** `./gradlew :power-monitor:testDebugUnitTest`. Esperado: PASA.
- [ ] **Paso 5: Verificar en el Xiaomi, sin cable.** Primero `adb pair <ip:puerto>` y `adb connect <ip:puerto>`, y desconectar el USB. Recompilar e instalar con `pnpm android`.
  - `adb shell dumpsys jobscheduler | grep -i pulso`. Esperado: un trabajo de WorkManager para el latido.
  - Apagar el router 2 minutos y volver a prenderlo. Esperado en la pantalla de registro: anotar si llegó un `network_callback` al caer el Wi-Fi (es la medición de la duda de A) y que sí llega uno al volver.
  - Desenchufar el cargador. Esperado: a los ~90 s, un `transition_check` con corriente apagada.
  - `adb reboot`. Esperado: un `boot` al arrancar y el latido vuelve a aparecer en `dumpsys jobscheduler`.
  - `adb shell am get-standby-bucket com.isaacmendoza.pulso`. Anotar el valor.
- [ ] **Paso 6:** Commit `feat(power-monitor): callback de red, latido, arranque y seguimiento de transición`

### Tarea 4: Mecanismos C y D

**Archivos:**
- Crear: `ChargingJobService.kt`, `PowerWatchService.kt`
- Modificar: `Arming.kt`, `PowerMonitorModule.kt` (`setForegroundServiceEnabled`), `AndroidManifest.xml`, `app.json` (`android.permissions` con `POST_NOTIFICATIONS`), `app/debug.tsx` y `power-monitor.ts`

**Interfaces:**
- Kotlin:
  - `ChargingJobService : JobService`, con id de trabajo `7001`, `setRequiresCharging(true)` y `setPersisted(true)`. `onStartJob` graba `"charging_job"` (la carga empezó) y programa `jobFinished` más una reprogramación a los 9 minutos. `onStopJob` graba `"charging_job"`, loguea `params.stopReason` y devuelve `true`. `Arming` lo programa si no está pendiente y guarda `armed.chargingJob`.
  - `PowerWatchService : Service`, en primer plano con `FOREGROUND_SERVICE_TYPE_SPECIAL_USE`, canal `"watch"` ("Vigilancia de la luz", importancia baja), notificación "Pulso está vigilando la luz" e id `1001`. Registra con `ContextCompat.registerReceiver(..., RECEIVER_NOT_EXPORTED)` un receiver de `ACTION_POWER_CONNECTED` y `ACTION_POWER_DISCONNECTED` que graba `"power_receiver"`. Devuelve `START_STICKY`.
  - Preferencia `fgs.enabled`: `Arming` arranca el servicio si está activa. Funciona desde la app en primer plano y desde `BOOT_COMPLETED`.
  - Manifiesto: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE` y el `<service android:foregroundServiceType="specialUse">` con `<property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="Detecta cuándo se va y vuelve la luz en casa escuchando la conexión del cargador"/>`. `ChargingJobService` lleva `android:permission="android.permission.BIND_JOB_SERVICE"`.
- JS: `setForegroundServiceEnabled(enabled: boolean): Promise<void>`. La pantalla de registro tiene el interruptor "Servicio en primer plano (D)", que antes de activar pide `POST_NOTIFICATIONS` con `PermissionsAndroid`.

- [ ] **Paso 1:** Implementar C y D. Esta tarea es integración con el sistema y no tiene lógica pura que testear en la JVM.
- [ ] **Paso 2: Verificar C en el Xiaomi, sin cable.**
  - `adb shell dumpsys jobscheduler | grep -A5 ChargingJobService`. Esperado: el trabajo `7001` está pendiente o corriendo.
  - Desenchufar el cargador real. Esperado: un `charging_job` con corriente apagada en segundos, y en `adb logcat -s PowerMonitor` el motivo de parada.
  - Enchufar. Esperado: un `charging_job` con corriente encendida.
- [ ] **Paso 3: Verificar D.** Activar el interruptor. Esperado:
  - La notificación es visible.
  - `adb shell dumpsys activity services com.isaacmendoza.pulso | grep -i isForeground` muestra `isForeground=true`.
  - Al desenchufar llega un `power_receiver`.
  - Después de `adb reboot`, el servicio vuelve solo.
- [ ] **Paso 4:** Probar también con `adb shell dumpsys battery unplug` y anotar en el commit qué mecanismos reaccionan a la simulación y cuáles solo al cable real.
- [ ] **Paso 5:** Commit `feat(power-monitor): trabajo con carga y servicio en primer plano experimentales`

### Tarea 5: Huella de la red de casa, diagnóstico, botones de verdad y exportar

**Archivos:**
- Crear: `HomeNetwork.kt`, `HomeNetworkTest.kt`, `Diagnostics.kt`, `Exporter.kt`, `src/modules/power-detection/__tests__/debug-screen.test.tsx`
- Modificar: `SnapshotReader.kt` (`homeWifi`), `PowerMonitorModule.kt`, `power-monitor.ts`, `app/debug.tsx`, `native-schema.ts`
- Instalar: `npx expo install expo-sharing`

**Interfaces:**
- Kotlin:
  - `class HomeNetwork(context: Context) { fun learnCurrent(): Boolean; fun matches(fingerprint: String?): Boolean? }`. `matches` devuelve `null` si no hay huella aprendida y `false` si la hay pero no hay Wi-Fi o no coincide.
  - `companion object { fun fingerprint(gatewayIpv4: String?, ipv4Network: String?): String?; fun ipv4Network(address: ByteArray, prefixLength: Int): String }`. `fingerprint` es el SHA-256 en hex de `"$gateway|$network"`, o `null` si no hay gateway.
  - `object Diagnostics { fun json(context: Context): String }`. Trae los campos de `nativeDiagnosticsSchema`, con `standbyBucket` de `UsageStatsManager.appStandbyBucket` y `ignoringBatteryOptimizations` de `PowerManager.isIgnoringBatteryOptimizations`.
  - `object Exporter { fun export(context: Context): String }`. Escribe `cacheDir/exports/pulso-<fabricante>-<yyyyMMdd-HHmm>.json` con `{ exportedAt, diagnostics, events }` y devuelve su URI `file://`.
  - Módulo: `recordReport(value: string): Promise<string>`, `learnHomeNetwork(): Promise<boolean>`, `getDiagnostics(): Promise<string>` y `exportEvents(): Promise<string>`.
- JS, `native-schema.ts` (los mismos esquemas que `pulso-api/src/domain/spike/schema.ts`, que es quien lee el exporte):
  - `nativeDiagnosticsSchema = diagnosticsSchema.extend({ storedEvents, homeNetworkLearned, armed: { networkCallback, heartbeat, chargingJob, foregroundService } })`
  - `spikeExportSchema = z.object({ exportedAt: epochMs, diagnostics: nativeDiagnosticsSchema, events: z.array(z.unknown()) })`. Los eventos se validan uno por uno después.
- JS: `recordReport(value: 'hay_luz' | 'fluctuando' | 'sin_luz'): Promise<void>`, `learnHomeNetwork(): Promise<boolean>`, `readDiagnostics(): Promise<NativeDiagnostics>` y `exportAndShare(): Promise<void>` (`exportEvents` y luego `Sharing.shareAsync`).

- [ ] **Paso 1: Escribir los tests que fallan**
  - `HomeNetworkTest`:
    - "misma red, misma huella": dos llamadas con `("192.168.1.1", "192.168.1.0/24")` devuelven lo mismo.
    - "otro gateway, otra huella".
    - "sin gateway no hay huella": `null`.
    - "calcula la red IPv4": `192.168.1.37/24` da `"192.168.1.0/24"` y `10.0.5.9/16` da `"10.0.0.0/16"`.
  - `native-schema` (en `power-monitor.test.ts`): "valida el diagnóstico del nativo". Un JSON sin `armed` falla.
  - `debug-screen.test.tsx`:
    - "el botón 'Se fue la luz ahora' guarda un reporte sin_luz": con el módulo nativo simulado, el botón llama a `recordReport('sin_luz')`.
    - Lo mismo para "Volvió" (`hay_luz`) y "Fluctuando" (`fluctuando`).
- [ ] **Paso 2:** Correr `./gradlew :power-monitor:testDebugUnitTest` y `pnpm test`. Esperado: FALLAN los nuevos.
- [ ] **Paso 3:** Implementar. `SnapshotReader` saca el gateway IPv4 de `LinkProperties.routes` (la ruta por defecto) y la red de `linkAddresses` (la primera IPv4) de la red Wi-Fi conectada. La pantalla de registro suma:
  - los botones grandes "Se fue la luz ahora", "Volvió" y "Fluctuando"
  - "Esta es la red de mi casa"
  - un bloque de diagnóstico: fabricante, bucket, optimización de batería y mecanismos armados
  - "Exportar"
- [ ] **Paso 4:** Correr los tres comandos del paso 2. Esperado: PASAN.
- [ ] **Paso 5: Verificar en el Xiaomi.**
  - "Esta es la red de mi casa". Esperado: `homeNetworkLearned: true`, y el siguiente snapshot trae `homeWifi: true`.
  - Conectar el Xiaomi al hotspot del iPhone y registrar. Esperado: `homeWifi: false`.
  - "Exportar" y compartir por WhatsApp. Esperado: llega un `.json` que abre.
- [ ] **Paso 6:** Commit `feat(power-monitor): huella de red de casa, diagnóstico, reportes y exporte`

### Tarea 6: APK release y teléfonos de la familia

**Archivos:**
- Crear: `docs/registrador.md`, con instrucciones en lenguaje llano para la familia: instalar el APK, permitir apps desconocidas, abrir Pulso, tocar "Esta es la red de mi casa", poner la batería en "Sin restricciones" (Xiaomi: más "Inicio automático"; Samsung: sacarla de "Apps en suspensión profunda"), dejarlo enchufado, tocar los botones cuando se vaya o vuelva la luz y exportar cada 3 o 4 días por WhatsApp.
- Modificar: `docs/roadmap.md` (marcar la fase 0)

- [ ] **Paso 1:** `pnpm android:release` con el Xiaomi conectado. Esperado: un APK en `android/app/build/outputs/apk/release/app-release.apk`, firmado con la clave de debug (sirve para instalar a mano, no para Play).
- [ ] **Paso 2:** Mandar el APK a 2 o 3 familiares con `docs/registrador.md`, incluido el Samsung de la familia, que se deja con los ajustes de batería de fábrica.
- [ ] **Paso 3: Verificar.** En cada teléfono, después de 1 hora, la pantalla de registro muestra al menos 4 `heartbeat`, todos los mecanismos armados y 0 inválidos.
- [ ] **Paso 4:** Con el primer exporte real del Xiaomi, `pnpm spike:analyze <archivo>` en `pulso-api`. Copiarlo a `pulso-api/test/fixtures/2026-xx-xx-xiaomi.json` solo si contiene un corte real.
- [ ] **Paso 5:** Commit `chore: registrador en teléfonos de prueba y fase 0 cerrada`

---

## Cierre de la fase

- `pnpm lint && pnpm typecheck && pnpm test` y los tests de Kotlin están en verde, y el CI de GitHub también.
- El registrador corre en 3 o más teléfonos, y al menos un exporte real pasó por `pnpm spike:analyze` en `pulso-api`.
- `docs/roadmap.md` tiene marcadas las tareas [app] de la fase 0. El plan de la fase 1 se escribe en `docs/plans/` antes de empezarla.
