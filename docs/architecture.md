# Arquitectura de la app

**Qué responde este documento**

- Cómo se reparte Pulso entre los dos repos
- Cómo está organizada la app y qué guarda el teléfono
- Cómo la app consume la API y cómo se mantiene el contrato
- Entornos, CI, costos y techos

Las decisiones con sus trade-offs están en `docs/decisions.md`. El backend se documenta en su propio repo (`pulso-api/docs/`).

## Dos repos

| Repo | Ruta local | Qué contiene | Se despliega con |
| --- | --- | --- | --- |
| `pulso-app` | `~/projects/personal/mobile/pulso-app` | App Expo, módulo Kotlin `power-monitor`, producto, Play Store, roadmap maestro | EAS Build → Google Play |
| `pulso-api` | `~/projects/personal/backend/pulso-api` | Worker Hono con PostgreSQL en Supabase, clasificador, push, páginas `/privacidad`, `/borrar-datos` y `/c/:code`, análisis del registrador, `openapi.json` | `wrangler deploy` desde GitHub Actions |

La app no importa código del backend. Todo pasa por HTTP y por el contrato OpenAPI (D-014, D-017).

## Estructura de la app

```text
pulso-app/
├─ app/                               # Expo Router: solo rutas y composición, sin tests
│  ├─ _layout.tsx
│  ├─ onboarding/                     # rol, UPS, notificaciones, batería, red de casa
│  ├─ (tabs)/                         # index (estado), history, family, settings
│  ├─ follow/[code].tsx               # abre el enlace /c/:code dentro de la app
│  └─ debug.tsx                       # registrador: eventos, diagnóstico, exportar
├─ modules/power-monitor/             # módulo Expo local en Kotlin: detección, almacén, subida
├─ src/
│  ├─ modules/
│  │  ├─ power-detection/             # envoltorio tipado del módulo nativo, estado crudo local
│  │  ├─ device/                      # registro anónimo, token al módulo, push token
│  │  ├─ outages/                     # historial y resumen semanal (datos del servidor)
│  │  ├─ reports/                     # reporte de un toque
│  │  ├─ family/                      # compartir código, seguir casas
│  │  └─ onboarding/                  # pasos y guías por fabricante
│  └─ shared/
│     ├─ api/generated/               # cliente generado desde openapi.json (no se edita a mano)
│     ├─ api/client.ts                # base URL, token, timeouts y reintentos
│     └─ ui/ · theme/ · config/
├─ __tests__/                         # tests de pantallas (fuera de app/)
├─ docs/
├─ AGENTS.md
└─ CLAUDE.md
```

## Recorrido de un evento

```text
Teléfono de la casa (Kotlin, sin depender de JS)
  callback de red · latido 15 min · trabajo con carga · servicio (si aplica) · arranque
        │  lee: corriente, Wi-Fi, internet, red de casa, pantalla, batería
        ▼
  EventStore (SQLite del módulo) ── 14 días locales; la UI lo lee para el estado crudo
        │  solo cambios de estado; el latido sube aunque no haya cambios
        ▼
  UploadWorker (WorkManager, requiere red, backoff y jitter de 0 a 60 s)
        │  POST /v1/events  ·  Bearer token
        ▼
pulso-api: valida, corrige el desfase, guarda idempotente, clasifica, decide el push
        ▼
Familia: push en Android · página /c/:code en cualquier navegador
```

## Qué muestra la app

| Dato | De dónde sale | Sin red |
| --- | --- | --- |
| Estado de la casa ("Sin luz desde las 6:05 p. m.") | `GET /v1/homes/me/status` | El último recibido, con su hora ("hace 20 min") |
| Estado crudo del teléfono ("En corriente", "Sin corriente desde las 6:05", "Wi-Fi de casa") | Último snapshot del módulo nativo | Siempre disponible |
| Historial y horas sin luz por semana | `GET /v1/homes/me/outages` | La caché persistida |
| Casas que sigo | `GET /v1/follows` | La caché persistida |

La app no clasifica cortes (D-016). Si el estado crudo y el del servidor no coinciden (por ejemplo, "sin corriente" pero el servidor todavía dice "con luz"), muestra los dos con su hora y no inventa una conclusión.

## Lo que guarda el teléfono

| Dato | Dónde | Cuánto tiempo |
| --- | --- | --- |
| Eventos (snapshots, reportes, confirmaciones), marcados como subidos o pendientes | SQLite del módulo nativo (`power_monitor.db`) | 14 días; se podan al insertar |
| Token del dispositivo | Bóveda del módulo nativo (clave AES-GCM en Android Keystore) | Hasta borrar los datos |
| Huella de la red de casa | SharedPreferences del módulo | Hasta reaprenderla o borrar los datos |
| Respuestas de la API | Caché persistida de TanStack Query | Se reemplaza al refrescar |

## Contrato con la API

1. `pulso-api` define cada ruta con `@hono/zod-openapi`, sirve `GET /openapi.json` y versiona `openapi.json` en su repo.
2. La app corre `pnpm api:generate` (`@hey-api/openapi-ts` con los plugins de cliente fetch, Zod y SDK). Toma `OPENAPI_SOURCE`: por defecto, el `openapi.json` de staging; en local, `../../backend/pulso-api/openapi.json`. El resultado va a `src/shared/api/generated/` y se versiona.
3. Las respuestas se validan con los esquemas Zod generados. Si algo no valida, se reporta a Sentry y se muestra un error, nunca un dato a medias.
4. Kotlin arma el JSON de `POST /v1/events` a mano. El backend tiene un test de contrato con un lote real exportado del Xiaomi.
5. **Compatibilidad:** las versiones viejas de la app siguen instaladas durante meses. El backend solo hace cambios aditivos en `/v1`. Un campo nuevo es opcional hasta que la versión mínima soportada lo mande.

En la fase 0 todavía no hay API. El envoltorio del módulo nativo valida los eventos con un esquema propio, `src/modules/power-detection/native-schema.ts`. En la fase 1 se reemplaza por el esquema generado.

## Entornos

| Entorno | API | App |
| --- | --- | --- |
| Local | `wrangler dev` en `localhost:8787` (accesible desde el teléfono con `adb reverse tcp:8787 tcp:8787`) | Dev build en el Xiaomi por Wi-Fi (`adb connect`) |
| Staging | `pulso-api-staging.<subdominio>.workers.dev` | Perfiles `development` y `preview` de EAS (APK) |
| Producción | `pulso-api.<subdominio>.workers.dev` | Perfil `production` de EAS (AAB a Play) |

`EXPO_PUBLIC_API_URL` cambia por perfil en `eas.json`. No contiene secretos.

## CI y builds

- GitHub Actions `ci.yml`: en cada push y PR corre `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` y `pnpm test`.
- Builds: en las fases 0 y 1 en la Mac (`expo run:android`); desde la fase 2 con EAS Build, y `eas build --local` si se agota la cuota gratuita.
- EAS Update para arreglos solo de JS durante la prueba cerrada (`runtimeVersion` con la política `fingerprint`). Todo cambio en Kotlin exige un build nuevo.

## Costos

| Pieza | Servicio | Costo en v1 |
| --- | --- | --- |
| Cuenta de desarrollador | Google Play Console | USD 25, pago único |
| Backend, base de datos y páginas | Cloudflare Workers + Hyperdrive y Supabase (ver `pulso-api/docs/architecture.md`) | USD 0 hasta ~600 teléfonos; luego Workers Paid, USD 5 al mes |
| Notificaciones | Expo Push sobre FCM | Gratis |
| Builds | Mac local y EAS Build gratuito | Gratis |
| **Total** | | **USD 25 una vez** (Play) |
| Errores | Sentry, plan gratuito | Gratis |
| Dominio | No hace falta: `*.workers.dev`, con HTTPS | USD 0 (uno propio es opcional, ~USD 12 al año) |
