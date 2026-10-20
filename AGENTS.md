# Pulso · app

App Android que detecta sola los cortes de luz de una casa, muestra el historial de horas sin luz y avisa a la familia que sigue esa casa.

Este repo tiene la app: Expo SDK 58 (solo Android en v1), con un módulo local en Kotlin, `modules/power-monitor`, que hace toda la detección en segundo plano. El backend vive en otro repo, `pulso-api` (en `~/projects/personal/backend/pulso-api`): un Worker de Hono en Cloudflare con PostgreSQL en Supabase (USD 0 al mes), que clasifica los cortes, manda los push y sirve `/privacidad`, `/borrar-datos` y `/c/:code`. La app lo consume solo por HTTP, con un cliente generado desde su `openapi.json` (D-014, D-017).

**Estado actual:** fase 0 (registrador). El roadmap maestro, con las tareas de los dos repos, está en `docs/roadmap.md`. El plan paso a paso está en `docs/plans/`.

## Comandos

Los que dependen de algo que todavía no existe se confirman al crearlo. Si cambian, actualiza esta tabla en el mismo commit.

| Tarea | Comando |
| --- | --- |
| Instalar dependencias | `pnpm install` |
| Lint, tipos y tests | `pnpm lint && pnpm typecheck && pnpm test` |
| App en el Xiaomi (dev build) | `pnpm android` |
| APK release para teléfonos de prueba | `pnpm android:release` |
| Tests de Kotlin | `cd android && ./gradlew :power-monitor:testDebugUnitTest` |
| Regenerar el cliente de la API (fase 1) | `pnpm api:generate` (lee `OPENAPI_SOURCE`) |
| Usar la API local desde el teléfono (fase 1) | `adb reverse tcp:8787 tcp:8787` |
| Analizar un exporte del registrador | En `pulso-api`: `pnpm spike:analyze <archivo.json>` |
| Conectar el teléfono sin cable | `adb pair <ip:puerto>` y luego `adb connect <ip:puerto>` |
| Simular desenchufe / restaurar | `adb shell dumpsys battery unplug` / `adb shell dumpsys battery reset` |
| Forzar Doze / salir | `adb shell dumpsys deviceidle force-idle` / `adb shell dumpsys deviceidle unforce` |
| Ver o forzar el bucket de standby | `adb shell am get-standby-bucket com.isaacmendoza.pulso` / `adb shell am set-standby-bucket com.isaacmendoza.pulso rare` |
| Logs del módulo nativo | `adb logcat -s PowerMonitor` (MIUI rota el buffer rápido: mejor leer la base) |
| Copiar la base de eventos del teléfono | `adb exec-out run-as com.isaacmendoza.pulso cat databases/power_monitor.db > pm.db` (y el `-wal`) |
| Ver los pedidos de red de Pulso | `adb shell dumpsys connectivity \| grep isaacmendoza` |
| Abrir la pantalla de registro | `adb shell am start -a android.intent.action.VIEW -d "pulso://debug"` |

## Convenciones de este proyecto

- Carpetas por dominio en `src/modules/<dominio>/`. `app/` (Expo Router) solo compone rutas, y los tests nunca van dentro de `app/`.
- El contrato con la API es el `openapi.json` de `pulso-api`. El código de `src/shared/api/generated/` se genera con `pnpm api:generate`, se versiona y nunca se edita a mano. Las respuestas se validan con sus esquemas Zod.
- La app no clasifica cortes (D-016). Muestra el estado que da el servidor y, aparte, el estado crudo del teléfono.
- Todas las horas viajan y se guardan como epoch en milisegundos. America/Caracas (UTC−4 fijo) se aplica solo al mostrar.
- Textos de la app en español venezolano llano: "se fue la luz", "volvió", "bajón". Código, archivos e identificadores en inglés; documentación en español.
- Commits en Conventional Commits.

## Reglas obligatorias

1. **No pedir permisos de ubicación en la v1**, ni leer SSID o BSSID. La red de casa se reconoce con una huella local (gateway y subred). Evita la revisión de ubicación de Google Play y es la promesa de privacidad del producto.
2. **Todo lo que corre en segundo plano vive en Kotlin** (`modules/power-monitor`). El JS nunca se asume vivo fuera de la pantalla.
3. **El token del dispositivo vive solo en la bóveda del módulo nativo (Android Keystore)**. Nunca en AsyncStorage, en JS persistente, en logs ni en Sentry.
4. **Cada evento conserva su hora original y un UUID v7 generado en el teléfono**. Nunca reescribir `at` ni reutilizar un `id`: el backend deduplica por `(device_id, id)`.
5. **El JSON que arma Kotlin sigue exactamente `pulso-api/docs/api.md`**. Un campo nuevo primero se agrega como opcional en el backend; después se manda desde la app. Al publicar una versión en Play, su lote real va a `pulso-api/test/fixtures/`.
6. **El teléfono sube solo los cambios de `(plugged, onWifi, homeWifi, internet)`**; el latido viaja aunque el lote esté vacío (D-008).
7. **`targetSdkVersion` 36 y `compileSdkVersion` 37** con `expo-build-properties`. El target es lo que exige Play; los módulos de SDK 58 exigen compilar contra 37. `android/` se genera y no se versiona: nada se edita a mano ahí.
8. **Ninguna variable `EXPO_PUBLIC_*` contiene secretos**, porque terminan dentro del bundle.
9. **Al terminar una tarea, márcala en `docs/roadmap.md` en el mismo commit**, y si se tomó una decisión de producto, regístrala en `docs/decisions.md`.

## Trampas conocidas

- **Expo cambia en cada SDK**: antes de escribir código con una API de Expo, React Native o EAS, consultar la documentación de la versión instalada (https://docs.expo.dev/versions/v58.0.0/ y el índice https://docs.expo.dev/llms.txt). No fiarse de la memoria. Paquetes nuevos siempre con `npx expo install`.
- **pnpm 12**: la configuración va en `pnpm-workspace.yaml`, no en `.npmrc` (`nodeLinker: hoisted` está ahí). Un paquete nuevo con script de instalación corta `pnpm install` hasta decidir en `allowBuilds` (`pnpm approve-builds`).
- **React Native Testing Library 14**: `render` es asíncrono (`await render(...)`).

- **El `PendingIntent` de `registerNetworkCallback` dispara una sola vez** (cuando una red queda disponible) y el sistema lo libera: nunca avisa al perder el Wi-Fi. Por eso A se arma solo sin Wi-Fi y detecta el fin del corte. Cada pedido necesita su propia acción en el Intent: ConnectivityService compara con `filterEquals` e ignora el `requestCode`. Ver "Hallazgos" en `docs/detection.md`.
- **MIUI apaga el "Inicio automático" en cada reinstalación por adb**: volver a activarlo después de cada `installDebug`, o el arranque y el latido no se reagendan.
- **Después de reiniciar, nada corre hasta el primer desbloqueo** (almacenamiento cifrado).
- **`dumpsys battery set/unplug` no le llega a JobScheduler**: no sirve para probar el mecanismo C y deja su estado contaminado unos minutos. Para C, cargador real y adb por Wi-Fi (`adb mdns services` encuentra el teléfono ya vinculado).
- **Android 8+ no entrega `ACTION_POWER_DISCONNECTED` a receivers del manifiesto.** Solo los ven un trabajo con `setRequiresCharging` (C) o un receiver dinámico dentro de un servicio (D).
- **Con el cable USB conectado el teléfono está cargando** y ninguna prueba de corte vale. Usar depuración inalámbrica.
- **Xiaomi**: `adb install` exige "Instalar vía USB" (cuenta Mi y SIM), y la app muere sin "Inicio automático" y la batería en "Sin restricciones". **Samsung**: sacarla de "Apps en suspensión profunda".
- **App Standby**: una app que nadie abre cae al bucket `rare` y sus trabajos se retrasan horas. El diagnóstico lo registra; no pedir `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
- **Router con mini UPS**: el Wi-Fi no cae durante el corte, así que el modo base no lo ve. Es el caso típico de los clientes de Yagos Store.
- **`org.json` en tests de JVM**: el de `android.jar` es un stub. Agregar `testImplementation 'org.json:json:…'`, y usar `JSONObject.NULL`, porque `put(key, null)` borra la clave.
- **Versiones viejas en Play**: la gente no actualiza. La app tiene que tolerar campos nuevos en las respuestas, y el backend, lotes de versiones anteriores.
- **16 GB de RAM**: probar en el Android físico, no en el emulador. No levantar Docker ni el simulador de iOS mientras compila Gradle.

## Documentación

- `docs/product.md`: qué es, qué ve cada persona, alcance por etapa, piloto con Yagos Store
- `docs/architecture.md`: dos repos, estructura de la app, qué guarda el teléfono, contrato con la API, entornos y costos
- `docs/decisions.md`: decisiones del producto con su fecha y trade-off, y las pendientes
- `docs/detection.md`: señales, mecanismos, prueba técnica y permisos
- `docs/security-privacy.md`: qué se guarda, amenazas, política y formulario de Play
- `docs/play-store.md`: cuenta, fechas, formularios y testers
- `docs/roadmap.md`: roadmap maestro con las tareas de los dos repos
- `docs/plans/`: plan paso a paso de cada fase de la app
- En `pulso-api/docs/`: `api.md` (endpoints y contrato), `classifier.md` (reglas y tests), `data-model.md` (PostgreSQL)
