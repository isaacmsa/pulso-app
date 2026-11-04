# Pulso v1 · Plan maestro de la app (fase 1 a Google Play)

> **Para agentes:** SUB-SKILL REQUERIDA: `superpowers:subagent-driven-development` para las tareas de código; las marcadas **[Xiaomi]** se hacen en la sesión principal con Isaac. Isaac aprueba este plan una sola vez: las fases se ejecutan seguidas, sin pedir otro plan ni otra aprobación, salvo en los **cortes** de la sección siguiente. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** llevar la app desde el registrador de la fase 0 hasta Pulso publicado en Google Play: detección que sube al servidor, pantallas de estado, historial y ajustes, familia con push y enlace, modo UPS, robustez y lanzamiento.

**Arquitectura:** Expo SDK 58 con el módulo `modules/power-monitor` en Kotlin para todo lo que corre en segundo plano (detección, bóveda del token, subida). La UI en React Native consume `pulso-api` con el cliente generado de la fase 1 y TanStack Query con caché persistida. El clasificador vive solo en el servidor (D-016). Cada cambio de contrato empieza en `pulso-api` (D-014): las tareas **[api]** de este plan las ejecuta la sesión del backend antes que la tarea de la app que las consume.

**Stack:** el de la fase 0, más `@hey-api/openapi-ts` 0.99.0, `@tanstack/react-query` con persistencia en AsyncStorage, `expo-notifications`, `@sentry/react-native` y EAS Build. Los paquetes de Expo se instalan con `npx expo install`.

**Spec:** `docs/product.md`, `docs/architecture.md`, `docs/detection.md`, `docs/security-privacy.md`, `docs/play-store.md`, `docs/roadmap.md`, `docs/decisions.md`, `pulso-api/docs/api.md` y el contrato de staging (`/openapi.json`).

## Cómo se ejecuta

1. **Una sola aprobación.** Con este plan aprobado, ejecuto fase tras fase. Desde el 30 de octubre, en modo ligero (pedido de Isaac para gastar menos): las tareas chicas las hago directo con TDD, sin revisor por tarea; hay una revisión de toda la fase al cerrarla, con una sola ronda de correcciones; el modelo más capaz queda para lo delicado (token, subida en segundo plano, push, borrados). Te aviso del avance, pero no te pido aprobar nada más, salvo los cortes de abajo.
2. **Las decisiones menores las tomo yo** y las anoto en `docs/decisions.md` con su trade-off. Te las listo al cerrar cada fase.
3. **Las verificaciones con el teléfono se agrupan**: una sesión con el Xiaomi por fase, no una por tarea.
4. **La sesión del backend** ejecuta las tareas [api] en el orden de este plan. Cuando una tarea de la app espera una del backend, sigo con la próxima que no dependa de ella.

## Cortes: dónde sí te necesito

Estos pasos no se pueden saltar ni hacer por ti: piden dinero o cuentas a tu nombre, el teléfono en la mano, datos reales o publicar algo.

| # | Cuándo | Qué | Por qué no lo puedo hacer yo |
| --- | --- | --- | --- |
| C1 | **Antes del 7 nov** (movido desde el 31 oct) | Pagar Play Console (USD 25) y empezar la verificación de identidad y del dispositivo | Es un pago y una cuenta a tu nombre (D-011). La verificación tarda días, y sin la cuenta no hay prueba cerrada el 18 o 19 de noviembre |
| C2 | Desde ya hasta el 9 nov | Que el registrador corra en 2 o más teléfonos de la familia y te manden sus exportes | D-012 necesita 5 o más cortes reales en 2 o más teléfonos. Es un dato, no código |
| C3 | Una vez por fase | Sesión con el Xiaomi: instalar, desenchufar, apagar la red y mirar la pantalla | Hay que tenerlo en la mano, y Xiaomi apaga el Inicio automático en cada instalación |
| C4 | **Antes de ~10 nov** (D-043) | Crear la cuenta de Expo y hacer `eas login`; crear la app en Play Console y subir el primer AAB | Son cuentas y publicación a tu nombre |
| C5 | **Antes de ~15 nov** (D-043) | Crear el proyecto de Firebase y subir la clave FCM V1 a EAS; conseguir un segundo Android (de la familia o el emulador con Google Play) | Es una cuenta a tu nombre y otro teléfono |
| C6 | Fase 4 | Crear las cuentas de Sentry y UptimeRobot | Son cuentas a tu nombre |
| C7 | 18–19 nov, ~27 nov, ~4 dic y ~5 dic | En Play Console: enviar la prueba cerrada a revisión, publicar las actualizaciones 1 y 2, y pedir el acceso a producción | Es publicar desde tu cuenta. Yo te dejo listos los textos, las capturas y las respuestas del cuestionario |
| C8 | ~13 dic | Lanzamiento escalonado: 20%, y 100% tras 48 h sin errores graves en Sentry | Es publicar desde tu cuenta |

**Sobre "probar el producto una vez terminado":** lo puedes probar completo antes de pedir el acceso a producción, alrededor del 5 de diciembre. Lo que Play no permite es esperar a que todo esté listo para empezar: la prueba cerrada tiene que correr 14 días con 12 o más testers, y Google espera ver actualizaciones reales durante ese tiempo (D-022). Por D-043 la versión del 18 o 19 de noviembre sale con todo lo construido (familia y push incluidos), y las actualizaciones 1 y 2 traen D-012, los arreglos de los testers y el ajuste de umbrales.

## Decisiones que este plan toma (se aprueban junto con el plan)

| Id | Decisión | Por qué | Costo |
| --- | --- | --- | --- |
| D-023 | Las respuestas se validan con el Zod generado. En `/v1`, el backend no agrega valores a un enum de respuesta: un estado nuevo va en un campo nuevo o en `/v2` | Una app vieja de Play no se actualiza, y un enum ampliado la haría fallar en esa ruta para siempre | Menos libertad en `/v1`. La regla se agrega también en `pulso-api/AGENTS.md` |
| D-024 | Timeout de 15 s y sin reintentos en el cliente JS. La subida la reintenta WorkManager; las pantallas, TanStack Query | Evita reintentos duplicados en dos capas | `docs/architecture.md` se corrige |
| D-025 | La URL base sale de `EXPO_PUBLIC_API_URL`, y staging es el valor por defecto. Cada perfil de EAS la define | Todavía no hay `eas.json` | El perfil `production` tiene que definirla (tarea 2b.2) |
| D-026 | El registro lo hace JS con el cliente generado. El token pasa en el momento a la bóveda nativa (`storeToken`), y JS lo lee con `getToken()` cuando lo necesita. Nunca se guarda en JS | Se reutiliza el cliente validado, y la subida en Kotlin lee el mismo token | El token pasa por la memoria de JS al registrarse y en cada llamada, nunca por almacenamiento persistente (regla 3) |
| D-027 | La subida es un `UploadWorker` de WorkManager (`HttpURLConnection`, sin dependencias nuevas). Lo encolan el latido (B) y cada evento que cambia el estado. Sale en lotes de hasta 200 y el último estado del servidor se guarda en el nativo | Todo lo de segundo plano vive en Kotlin (regla 2). Así la app sin red muestra "el último estado del servidor" (D-016) | Hay un cliente HTTP mínimo en Kotlin aparte del cliente JS. Su JSON lo cubren los tests de `EventJson` |
| D-028 | Los botones Sí y No de la confirmación abren la app (`opensAppToForeground: true`), y JS guarda el evento `confirmation` en el nativo | Una acción de notificación sin abrir la app necesitaría un receiver propio. Abrir la app es fiable en todos los fabricantes | Responder abre la app un instante |
| D-029 | Si el 9 de noviembre no hay 5 cortes en 2 teléfonos, D-012 se toma con lo que haya: se quitan solo los mecanismos que los datos descartan, y D queda como opción en ajustes y apagada por defecto | La fecha de la prueba cerrada no se mueve, y no se borra nada sin evidencia | Si D sigue en el manifiesto, Play pide declarar `specialUse` con un video (corte C4) |

## Restricciones globales

- Las 9 reglas obligatorias y las trampas de `AGENTS.md` valen en todas las tareas.
- `targetSdkVersion` 36 y `compileSdkVersion` 37. Paquete `com.isaacmendoza.pulso`. `android/` no se versiona.
- Nada de permisos de ubicación, SSID ni BSSID. No se pide `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
- El token vive solo en la bóveda nativa (Android Keystore, AES-GCM). Nunca en AsyncStorage, en logs ni en Sentry.
- Cada evento conserva su `at` y su UUID v7. Se suben solo los cambios de `(plugged, onWifi, homeWifi, internet)`, y el latido viaja aunque el lote esté vacío.
- `src/shared/api/generated/` solo cambia con `pnpm api:generate`.
- Textos en español venezolano llano ("se fue la luz", "volvió", "sin noticias"). Modo oscuro por defecto. Las horas se muestran en America/Caracas.
- Estados del servidor y sus textos, como en `docs/product.md`:
  - "Hay luz desde las 2:30 p. m."
  - "Se fue la luz a las 6:05 p. m. (1 h 20 min)"
  - "Sin noticias de la casa desde las 7:10 p. m."
- Commits en Conventional Commits, con el autor `isaac.mendozasa@gmail.com` y sin atribución. Al cerrar una tarea, se marca su línea en `docs/roadmap.md` en el mismo commit.
- Si se va tarde, se recorta en el orden de "Si vamos tarde" del roadmap. Nunca se recortan la detección, la privacidad, el borrado, las confirmaciones ni los respaldos.

## Foco de revisión

1. **El teléfono pierde la red a mitad de un lote**: al reenviar no se duplica nada (el servidor deduplica por `(device_id, id)`), y el cursor de subida solo avanza con un 2xx. Tests "el cursor no avanza si la respuesta no es 2xx" y "un reenvío tras timeout manda los mismos ids" (tarea 2a.2).
2. **El servidor responde 401 porque se borró el dispositivo**: la subida se detiene, no reintenta para siempre, y la app vuelve al onboarding. Tests "401 detiene la subida y marca el token como inválido" (2a.2) y "con el token inválido, la app abre el onboarding" (2a.3).
3. **Muchas horas sin red**: con más de 200 eventos pendientes se suben en varios lotes, en orden, y no se pierde ninguno. Test "450 pendientes salen en 3 lotes ordenados" (2a.2).
4. **Una app vieja recibe una respuesta con campos nuevos**: se acepta. Si trae un enum desconocido, la pantalla muestra un error y no se cae. Tests de contrato de la fase 1 y "Estado muestra el error cuando la respuesta no cumple el contrato" (2b.1).
5. **"Borrar mis datos" sin red**: no borra nada local hasta que el servidor confirme. Si falla, lo dice y ofrece reintentar. Test "sin red, borrar no toca el teléfono y muestra el error" (2b.1).

---

## Fase 1 · Cliente de la API (S3, ~1,5 h)

Detalle completo en `docs/plans/2026-10-23-fase-1-cliente-api.md` (tareas 1 a 3). Sus decisiones son D-023, D-024 y D-025.
- **Produce:** `src/shared/api/generated/`, y en `src/shared/api/client.ts` `setTokenProvider`, `unwrap`, `ApiError` y `REQUEST_TIMEOUT_MS`.
- **Corte C3:** "API: en línea" en el Xiaomi. Se junta con la sesión del Xiaomi de la fase 2a si conviene.

---

## Fase 2a · Subida, decisión y onboarding (S4, ~6 h)

**Depende de [api] fase 2:** `GET /v1/homes/me/outages`, `/privacidad` y `/borrar-datos`, el proyecto de producción y el respaldo nocturno. La sesión del backend lo hace en paralelo; la tarea 2a.4 es la única que lo necesita.

### Tarea 2a.1: bóveda del token y configuración nativa

**Archivos:** crear `TokenVault.kt` y `ApiConfig.kt` en `modules/power-monitor/android/src/main/java/expo/modules/powermonitor/`, y su test `TokenVaultTest.kt`. Modificar `PowerMonitorModule.kt`, `modules/power-monitor/src/PowerMonitor.types.ts` y `src/modules/power-detection/power-monitor.ts`.

**Interfaces que produce:**
- **Kotlin:**
  - `TokenVault.store(context, token: String)`, `TokenVault.read(context): String?`, `TokenVault.clear(context)` y `TokenVault.markInvalid(context)` / `isInvalid(context): Boolean`.
  - `ApiConfig.save(context, apiUrl: String, appVersion: String)` y `ApiConfig.read(context): ApiConfig?`.
- **JS:** `storeToken(token: string): Promise<void>`, `getToken(): Promise<string | null>`, `isTokenInvalid(): Promise<boolean>` y `configureApi(apiUrl: string): Promise<void>`.

**Diseño:** clave AES-256-GCM en `AndroidKeyStore` con el alias `pulso_token_key`, y el texto cifrado junto con el IV en SharedPreferences `pulso_vault`. Si el Keystore no puede leerla, por ejemplo tras restaurar en otro teléfono, `read` devuelve `null` y deja que el onboarding vuelva a registrar. `allowBackup` ya es `false`.

**Tests:**
- `TokenVaultTest` (Robolectric o con un cifrador inyectable):
  - "lo guardado se lee igual"
  - "clear deja null"
  - "un texto cifrado corrupto devuelve null sin lanzar"
- JS: `power-monitor.test.ts` agrega "getToken devuelve null cuando el nativo no tiene token". `setTokenProvider(getToken)` queda conectado en `app/_layout.tsx`.

**Commit:** `feat(native): bóveda del token en Android Keystore`.

### Tarea 2a.2: `UploadWorker`

**Archivos:**
- Crear `UploadWorker.kt`, `BatchBuilder.kt`, `ApiHttp.kt` y `LastServerStatus.kt`, y los tests `BatchBuilderTest.kt` y `UploadWorkerTest.kt`.
- Modificar `EventStore.kt` (columna `uploaded INTEGER NOT NULL DEFAULT 0`), `HeartbeatWorker.kt` y `SnapshotRecorder.kt` (encolar la subida) y `Diagnostics.kt` (`pendingEvents` = no subidos).

**Interfaces que produce:**
- `BatchBuilder.build(pending: List<Event>, lastSent: SnapshotState?, diagnostics: JSONObject, sentAt: Long): Batch`, con `Batch(events, json, skippedIds)`. `skippedIds` son los snapshots que no cambian el estado: se marcan como subidos sin enviarse.
- `UploadWorker.enqueue(context)`: `enqueueUniqueWork("upload", APPEND_OR_REPLACE)`, con la restricción `NetworkType.CONNECTED`, backoff exponencial de 30 s, como máximo 3 reintentos (después termina y la siguiente subida la arranca el próximo latido o cambio) y un retraso inicial aleatorio de 0 a 60 s, como dicen `docs/architecture.md` y `pulso-api/docs/api.md`.
- `LastServerStatus.read(context)` (el JSON de `{ status, receivedAt }`) y la función JS `getLastServerStatus(): Promise<{ status: HomeStatus; receivedAt: number } | null>`, validada con `zHomeStatus`.

**Comportamiento:**
- Lee hasta 200 pendientes en orden de `at` y luego de `id`, y hace `POST /v1/events` con `Authorization: Bearer`.
- **2xx:** marca como subidos los enviados y los saltados, guarda `status` y sigue mientras queden pendientes.
- **429:** reintenta respetando `Retry-After`.
- **401:** llama a `TokenVault.markInvalid` y termina sin reintentar.
- **400:** los eventos de ese lote quedan rechazados (no se reenvían) y sigue el lote siguiente. Un evento guardado ilegible también se rechaza.
- **404** (sin casa): `Result.failure()`, sin reintento.
- **Otro error, sin red o una excepción inesperada:** `Result.retry()`, hasta 3 veces.
- **Sin token:** no hace nada.

**Tests:**
- `BatchBuilderTest`:
  - "salta el snapshot que repite (plugged, onWifi, homeWifi, internet)"
  - "reportes y confirmaciones siempre viajan"
  - "lote vacío igual se construye (latido)"
  - "corta en 200"
  - "el JSON tiene exactamente sentAt, diagnostics y events"
- `UploadWorkerTest`, con `MockWebServer` o un `ApiHttp` falso:
  - "el cursor no avanza si la respuesta no es 2xx"
  - "un reenvío tras timeout manda los mismos ids"
  - "450 pendientes salen en 3 lotes ordenados"
  - "401 detiene la subida y marca el token como inválido"
  - "429 reintenta"
  - "guarda el status de la respuesta"

**Commit:** `feat(native): subida de eventos con WorkManager`.

### Tarea 2a.3: registro y onboarding

**Archivos:**
- Crear `app/onboarding/{index,battery,home}.tsx` y `src/modules/onboarding/{register.ts,battery-guide.ts}`.
- Crear sus tests en `src/modules/onboarding/__tests__/`.
- Modificar `app/_layout.tsx`: redirige al onboarding si no hay token o si es inválido. En el nativo, agregar `openBatterySettings(kind: 'autostart' | 'battery')`.

**Interfaces que produce:**
- `register(): Promise<void>`: `registerDevice({ appVersion })`, luego `storeToken`, `configureApi(API_URL)`, `arm()` y, si el usuario eligió vigilar, `createHome()`. Es idempotente: si ya hay token válido no hace nada, y un `home_exists` cuenta como éxito.
- `batteryGuide(manufacturer: string): BatteryStep[]`: Xiaomi, Redmi y Poco (Inicio automático y Sin restricciones), Samsung (suspensión profunda), Tecno, Infinix y el genérico, con los textos de `docs/registrador.md`.

**Pantallas:**
1. "¿Este teléfono se queda en casa?": **Vigilar mi casa** o **Solo seguir una casa**.
2. Permiso de notificaciones.
3. Guía de batería del fabricante, con botones que abren sus pantallas.
4. "Conéctate al Wi-Fi de tu casa" y luego `learnHomeNetwork`.

Con **Solo seguir** se salta el 3 y el 4, y no se arma la detección.

**Tests:**
- "registra una sola vez aunque se llame dos veces"
- "home_exists cuenta como éxito"
- "si el registro falla sin red, muestra el error y permite reintentar"
- "con el token inválido, la app abre el onboarding"
- "Solo seguir no arma la detección"
- "batteryGuide('Xiaomi') incluye Inicio automático"

**Commit:** `feat(onboarding): registro, batería y red de casa`.

### Tarea 2a.4: D-012 (corte C2)

Con los exportes de la familia: `pnpm spike:analyze` en `pulso-api` para cada uno, una tabla de datos en `docs/detection.md` y la decisión en `docs/decisions.md` con el criterio de `docs/detection.md`. Si faltan datos, se aplica D-029.

Luego se borran del código y del manifiesto los mecanismos descartados, junto con sus tests, y en el mismo commit se quita el interruptor de D de la pantalla de registro si D sale. Los tests de Kotlin y de JS quedan en verde.

**Commit:** `feat(detection): D-012, mecanismos de producción`.

### Verificación de la fase (corte C3)

En el Xiaomi:
1. Hacer el onboarding completo desde cero.
2. Simular un corte: desenchufar 15 min con el Wi-Fi apagado.
3. Volver a enchufar y encender el Wi-Fi.

`GET /v1/homes/me/status` de staging muestra el corte, y la pantalla de registro dice "pendientes: 0".

---

## Fase 2b · App usable y prueba cerrada (S5, ~5,5 h)

**Depende de [api] fase 2** (`GET /v1/homes/me/outages` y producción con `/privacidad`).

### Tarea 2b.1: Estado, Historial y Ajustes

**Archivos:**
- Crear `app/(tabs)/_layout.tsx`, `app/(tabs)/{index,history,settings}.tsx` y `src/modules/home/{queries.ts,format.ts}`.
- Crear `src/shared/query/client.ts` (QueryClient con persistencia en AsyncStorage; en esa caché nunca va el token) y los tests de cada pantalla.
- `app/index.tsx` pasa a ser la pestaña Estado, y el enlace al registrador queda en Ajustes → Diagnóstico.

**Interfaces que produce:**
- `useHomeStatus()`: `getHomeStatus`, que sin red cae en `getLastServerStatus()` y muestra su `receivedAt` ("hace 20 min").
- `useOutages(from: number, to: number)`.
- `formatStatus(status: HomeStatus, now: number): string`, con los tres textos de las restricciones.
- `formatDuration(ms: number): string` ("1 h 20 min").

**Pantallas:**
- **Estado:**
  - Estado del servidor.
  - Estado crudo del teléfono ("Sin corriente desde las 6:05 p. m.").
  - El reporte de un toque: Hay luz, Fluctuando y Sin luz.
- **Historial:** la semana por día, con el total en horas.
- **Ajustes:**
  - Alias (`updateHome`).
  - Diagnóstico.
  - "Política de privacidad", que abre `/privacidad`.
  - "Borrar mis datos": primero `deleteDevice`, y solo con 204 se llama al `wipe()` nativo y la app vuelve al onboarding.
  - Interruptor de D si D-012 lo dejó.

**Tests:**
- "formatStatus da los tres textos de producto"
- "formatDuration(4800000) es '1 h 20 min'"
- "Estado muestra el último estado del servidor sin red"
- "Estado muestra el error cuando la respuesta no cumple el contrato"
- "Historial suma la semana"
- "sin red, borrar no toca el teléfono y muestra el error"
- "con 204, borrar llama a wipe y vuelve al onboarding"

**Nativo:** `wipe()` vacía el almacén, la bóveda, la huella y `LastServerStatus`, y cancela todos los trabajos. Test `WipeTest`: "wipe deja el almacén vacío y sin trabajos".

**Commit:** `feat(app): pantallas de estado, historial y ajustes`.

### Tarea 2b.2: EAS y builds (corte C4)

- `eas.json` con tres perfiles:
  - `development`: dev client y APK.
  - `preview`: APK interno contra staging.
  - `production`: AAB contra `https://pulso-api.isaac-mendozasa.workers.dev`.
- Cada perfil define `EXPO_PUBLIC_API_URL`.
- `app.json` con `version` y `android.versionCode` llevados por EAS (`appVersionSource: remote`).

**Verificación:** `eas build -p android --profile preview` instala en el Xiaomi y muestra "API: en línea".

**Commit:** `chore(eas): perfiles de build`.

### Tarea 2b.3: Play, prueba interna y prueba cerrada (cortes C4 y C7)

**Lo que dejo listo yo:**
- `docs/play-store.md`:
  - El nombre, la descripción corta y la larga.
  - Las respuestas de todos los formularios, coherentes con `docs/security-privacy.md`.
  - Si D sigue, el guion del video de `specialUse`.
- `assets/store/`: ícono de 512 px y gráfico destacado de 1024 × 500. Las capturas son del Xiaomi, en modo oscuro.

**Lo que haces tú:** crear la app en Play Console, subir el AAB a la prueba interna y, el 18 o 19 de noviembre, enviar la prueba cerrada a revisión.

**Commit:** `docs(play): ficha y formularios de la prueba cerrada`.

---

## Fase 3 · Familia, push y UPS (S5–S6, ~7 h): actualización 1

**Depende de [api] fase 3:**
- El módulo de push.
- `POST`, `GET` y `DELETE /v1/follows`.
- `POST /v1/homes/me/share-code`.
- `/c/:code`.
- `assetlinks.json`, con el SHA-256 de la clave de firma de Play que le pasas al backend.

### Tarea 3.1: push token y notificaciones (corte C5)

- `npx expo install expo-notifications`.
- Credenciales FCM V1 en EAS.
- `registerPushToken()`: `getExpoPushTokenAsync`, luego `updateDevice({ pushToken })`. Corre al iniciar y cada vez que cambia el token.
- Canal Android `cortes`, con importancia alta.

**Tests:**
- "manda el push token una sola vez si no cambió"
- "sin permiso no llama a updateDevice"

### Tarea 3.2: confirmación Sí/No

- Categoría `confirm_outage`, con las acciones `yes` y `no` y `opensAppToForeground: true` (D-028).
- El `data` del push trae `outageStart`.
- La respuesta llama a `recordConfirmation(outageStart, answer)` en el nativo, que guarda un evento `confirmation` y encola la subida.

**Tests:**
- JS: "tocar Sí guarda confirmation con answer true y el outageStart del push"
- Kotlin: `EventJsonTest` agrega "confirmation se serializa con outageStart y answer"

### Tarea 3.3: familia

**Pantallas:**
- **Compartir mi casa:** `Share` con el mensaje "Sigue la luz de mi casa en Pulso: https://pulso-api.isaac-mendozasa.workers.dev/c/CODIGO".
- **Regenerar código:** `POST /v1/homes/me/share-code`. Quita a todos los seguidores (D-030), así que antes se confirma con el texto "Las personas que siguen tu casa dejarán de verla hasta que les mandes el código nuevo".
- **Seguir una casa:** código de 8 caracteres en mayúsculas, con el alfabeto de la API.
- **Casas que sigo:** cada casa con su estado, y deslizar para dejar de seguir.

**App Links:** `intentFilters` con `autoVerify` para `/c/*` en `app.json`. El enlace abre "Seguir esta casa".

**Tests:**
- "el código se normaliza a mayúsculas y rechaza letras fuera del alfabeto"
- "seguir una casa inexistente muestra 'Ese código no existe'"
- "dejar de seguir la quita de la lista"
- "el enlace /c/ABCD2345 abre seguir con el código"

### Tarea 3.4: modo UPS

- Interruptor "Mi router tiene UPS" en el onboarding (vigilar) y en Ajustes, que llama a `updateHome({ mode })`.
- Usa el mecanismo que dejó D-012: C si ve el desenchufe con la pantalla apagada; si no, D.

**Test:** "activar UPS llama a updateHome con mode ups".

### Verificación y publicación (cortes C3, C5 y C7)

Un corte simulado en el Xiaomi llega como push al segundo Android que sigue la casa, y `/c/:code` muestra "Se fue la luz a las…". Después tú publicas la actualización 1 en la pista cerrada (~27 nov). Yo dejo listo el aviso para el grupo de WhatsApp de testers.

---

## Fase 4 · Robustez (S6–S7, ~6,75 h): actualización 2

**Depende de [api] fase 4:** "sin noticias", `sin_datos`, retención y Sentry del backend.

### Tarea 4.1: Sentry (corte C6)

- `npx expo install @sentry/react-native` y el plugin de EAS para los source maps.
- `sendDefaultPii: false`. En `beforeSend` y `beforeBreadcrumb` se filtran `Authorization`, `token` y cualquier valor con forma de token.

**Test:** "beforeSend borra Authorization y token de la petición y de los breadcrumbs".

### Tarea 4.2: aviso de detección en riesgo

En Estado aparece el aviso si se cumple alguna de estas condiciones:
- El bucket es `rare` (40) o `restricted` (45).
- `ignoringBatteryOptimizations` es `false` en un fabricante de la lista de riesgo.
- El último latido tiene más de 40 minutos.

El aviso lleva a la guía de batería.

**Tests:**
- "bucket 40 muestra el aviso"
- "latido de hace 41 min muestra el aviso"
- "todo bien no muestra nada"

### Tarea 4.3: historial con barras

Barras por día (`View` con su altura, sin librería de gráficos) y comparación con la semana anterior ("2 h 10 min más que la semana pasada").

**Tests:**
- "la barra más alta es la del día con más horas"
- "la comparación dice más o menos con su diferencia"

### Tarea 4.4: estados vacíos, de error y sin red; accesibilidad

- Cada pantalla tiene sus tres estados.
- Los botones llevan `accessibilityLabel`.
- Los textos se pueden agrandar sin cortarse.

**Tests:** un test por pantalla y estado.

### Verificación y publicación (cortes C3 y C7)

Con el Wi-Fi y los datos del Xiaomi apagados durante 45 minutos, el segundo Android muestra "Sin noticias de la casa desde las…". Al volver la red, se ve el estado correcto. Después tú publicas la actualización 2 (~4 dic).

---

## Fase 5 · Producción (S7–S9)

### Tarea 5.1: revisión de seguridad y rendimiento

Skill `security-perf-review` sobre los dos repos. Los hallazgos críticos e importantes se corrigen con su test antes de pedir producción.

### Tarea 5.2: D-013 y contrato final

- La sesión del backend ajusta `MIN_OUTAGE_MS` y `TRANSITION_MS` con las confirmaciones de la prueba.
- El lote real de la versión de producción se copia a `pulso-api/test/fixtures/` (regla 5).

### Tarea 5.3: solicitud de producción y ficha final (cortes C7 y C8)

**Lo que dejo listo yo:**
- Las respuestas del cuestionario, con los datos reales de la prueba: testers inscritos, qué reportaron y qué cambió en cada actualización.
- Las capturas finales.
- Los README de los dos repos, listos para el portafolio, con la tabla de evidencia de `docs/product.md`.

**Lo que haces tú:** enviar la solicitud y luego el lanzamiento escalonado.

### Cierre del proyecto

Pulso queda en Google Play al 100%, con 48 h sin errores graves en Sentry, y `docs/roadmap.md` queda con todas las tareas marcadas.

## Sesión con el Xiaomi (corte C3), 3 y 4 de noviembre

Primera prueba en un teléfono real, con el APK release contra staging.

**Pasó:** el onboarding completo, que retoma donde quedó si MIUI mata la app; el registro y la bóveda; el reporte manual de un corte real y el regreso detectado en segundo plano por C; el latido toda la noche con la pantalla bloqueada; el modo UPS con `locked` (D-044); "Borrar mis datos" contra el servidor; "Solo seguir" sin nada armado aunque cargue; seguir una casa con su código; pasar de seguir a vigilar.

**Se arregló en la sesión:**
- la instalación nueva empezaba en el último paso del onboarding (4792f5e);
- "Fluctuando" partido en dos líneas, la barra de navegación blanca y el contenido bajo la barra de estado (393662b, b74f9e1);
- el modo UPS no detectaba cortes en MIUI (226da25, A-050).

**Pendiente, sin arreglar todavía:**
- [ ] Tras el corte real del 3 de noviembre a las 7:42 p. m., el enchufe recién se vio con el latido de las 2:16 a. m. Falta saber a qué hora volvió la luz para decir si C llegó tarde.
- [x] `app_version` del dispositivo se quedó en 0.1.0 después de actualizar a 0.2.0: la app no la reportaba al actualizarse. Ahora la manda con `PATCH /v1/devices/me` al arrancar si cambió (`reportAppVersion`).
- [ ] Una casa que vuelve de "sin noticias" muestra "Hay luz desde" la hora del latido, aunque la luz nunca se fue (A-037). El texto confunde.
- [ ] El reporte manual "Sin luz" toma la hora del toque; no se puede decir "se fue a la 1:00".
- [ ] Capturas para Play: 5 de 7 en `assets/store/screenshots-raw/` (falta la de un corte y la del push, que espera C5). Falta enmarcarlas en 1080 × 1920.
