# Decisiones

**Qué responde este documento**

- Qué se decidió para el producto, cuándo y por qué
- Qué se sacrificó en cada decisión
- Qué decisiones están pendientes y con qué dato se toman

Aquí van las decisiones que afectan al producto o a la app. Las internas del backend viven en `pulso-api/docs/decisions.md` (prefijo `A-`). Una decisión nueva se agrega al final con el siguiente número. Si cambia, no se borra: se marca "Reemplazada por D-0xx".

| Id | Fecha | Decisión | Por qué | Lo que se sacrifica |
| --- | --- | --- | --- | --- |
| D-001 | 2026-10-19 | ~~Monorepo con workspaces de pnpm~~ **Reemplazada por D-014** | | |
| D-002 | 2026-10-19 | Expo SDK 58 (expo 58.0.16, React Native 0.88, React 19.3), solo Android, `targetSdkVersion` 36 y `compileSdkVersion` 37 (los módulos de SDK 58 exigen compilar contra Android 37; el target es lo que pide Play), con Continuous Native Generation (`android/` no se versiona) | Es el SDK estable. API 36 es requisito de Play desde el 31 de agosto de 2026 | El código nativo vive solo en el módulo local; nada se edita a mano en `android/` |
| D-003 | 2026-10-19 | Detección nativa primero: Kotlin lee, guarda y sube los eventos; el JS solo pinta la interfaz | El JS en segundo plano es lo primero que matan Android y los fabricantes | Más Kotlin (~600 líneas). El JSON de Kotlin hay que mantenerlo alineado con el contrato; lo cubre un test con un lote real en el backend |
| D-004 | 2026-10-19 | Eventos append-only con UUID v7 generado en el teléfono como clave de idempotencia; `device_at` intacto y `at` corregido aparte | Un reintento no duplica, y las confirmaciones no dependen de un id del servidor | Un poco más de lógica en el servidor para reconciliar cortes |
| D-005 | 2026-10-19 | Casas (`homes`) separadas de dispositivos (`devices`) | Permite seguidores sin casa, un iPhone seguidor en v1.1 y, más adelante, varios teléfonos por casa | Una tabla y un join más |
| D-006 | 2026-10-19 | Sin app web aparte: la API sirve `/privacidad`, `/borrar-datos` y `/c/:code` como HTML (`hono/jsx`) | Play exige la política de privacidad en una URL pública y una vía de borrado, y la familia con iPhone o sin la app necesita ver el estado desde el enlace de WhatsApp | Next.js queda para v1.1. Si se quita `/c/:code`, la familia necesita Android y la app |
| D-007 | 2026-10-19 | ~~Prueba cerrada enviada a revisión el 15 o 16 de noviembre~~ **Reemplazada por D-019** | | |
| D-008 | 2026-10-19 | El teléfono sube solo los cambios de `(plugged, onWifi, homeWifi, internet)`; el latido solo actualiza `last_seen_at` | Baja ~10 veces las filas escritas y estira el plan gratuito a ~800 teléfonos | El clasificador tiene que ser invariante a snapshots repetidos (está testeado) |
| D-009 | 2026-10-19 | Biome para lint y formato en los dos repos; jest-expo en la app; Vitest en el backend | Una sola herramienta rápida de lint y formato | Menos reglas de React Native que `eslint-config-expo` |
| D-010 | 2026-10-19 | `applicationId` `com.isaacmendoza.pulso` | No hay dominio propio y el id es permanente en Play | Cambiarlo después de la primera subida obliga a publicar otra app |
| D-011 | 2026-10-19 | Las cuentas se crean justo cuando hacen falta, salvo Play Console, que se adelanta a la semana 2 | Nada se paga ni se configura antes de usarlo. La verificación de Play puede tardar días | El único pago es Play (USD 25); Cloudflare y Supabase no piden tarjeta |
| D-012 | Pendiente, 9 nov | Qué mecanismos de detección quedan en producción (A, B, C, D) | Se decide con los datos del registrador y el criterio de `docs/detection.md` | |
| D-013 | Pendiente, ~1 dic | Valores finales de `MIN_OUTAGE_MS` y `TRANSITION_MS` | Se decide con las confirmaciones de la prueba cerrada | |
| D-014 | 2026-10-19 | Dos repos: `pulso-app` (Expo + módulo Kotlin) y `pulso-api` (backend). La app consume el backend solo por HTTP | Cada uno se entiende, se prueba y se despliega solo, y el backend puede cambiar de tecnología sin tocar la app | Un cambio de contrato son dos PR en orden: primero el backend, compatible con la versión anterior, y después la app regenera su cliente |
| D-015 | 2026-10-19 | ~~Backend en Hono sobre Cloudflare Workers y D1~~ **Reemplazada por D-018** | | |
| D-016 | 2026-10-19 | El clasificador vive solo en el backend. Sin red, la app muestra el estado crudo del teléfono ("en corriente", "Wi-Fi de casa") y el último estado que dio el servidor | Una sola implementación: es imposible que la app y la familia vean cosas distintas | Sin red, la app no dice "se fue la luz a las 6:05": dice "sin corriente desde las 6:05" y el último estado del servidor |
| D-017 | 2026-10-19 | El contrato es el OpenAPI que genera el backend con `@hono/zod-openapi` (`openapi.json` versionado en `pulso-api`). La app genera tipos, esquemas Zod y SDK con `@hey-api/openapi-ts` y versiona el código generado | Una sola fuente de verdad, con validación en tiempo de ejecución en los dos lados, y el build de la app no depende de la red | Hay que regenerar el cliente al cambiar la API (`pnpm api:generate`) |
| D-018 | 2026-10-19 | ~~NestJS 12 y PostgreSQL en un VPS propio~~ **Reemplazada por D-021** | | |
| D-019 | 2026-10-19 | ~~Prueba cerrada el 22 o 23 de noviembre~~ **Reemplazada por D-022** | | |
| D-020 | 2026-10-19 | Objetivo del proyecto: portafolio para roles mobile cross-platform y full stack, demostrando que llevas una app a producción por tu cuenta. La app sigue en Expo + módulo Kotlin | Se evaluó Android nativo (Kotlin + Compose) y luego iOS nativo. Para esos roles, React Native en producción con un módulo nativo propio pesa más, y el iPhone seguidor de v1.1 sale de la misma base de código | El proyecto no demuestra Compose ni SwiftUI |
| D-021 | 2026-10-20 | Backend en TypeScript con Hono sobre Cloudflare Workers y PostgreSQL en Supabase, conectado por Hyperdrive, con Drizzle | Costo mínimo: USD 0 al mes, y ni Cloudflare ni Supabase piden tarjeta, lo que esquiva el problema de pagar desde Venezuela. PostgreSQL sigue en el portafolio, y el código (Hono + postgres.js) corre igual en Node si algún día hay que salir de Workers | No es runtime Node ni NestJS, y no demuestra operar un servidor propio. Techo gratis de ~600 teléfonos por las consultas de Hyperdrive; después, Workers Paid (USD 5 al mes) |
| D-022 | 2026-10-20 | Prueba cerrada enviada a revisión el 18 o 19 de noviembre; familia, push y UPS como actualización 1 (~27 nov). Meta en Play: ~15 de diciembre | Workers + Supabase ahorra ~9 h frente a NestJS en un VPS, pero suma ~2 h frente a D1 (Supabase, Hyperdrive, funciones de ingesta) | Unos 6 días de colchón antes del 21 de diciembre |
