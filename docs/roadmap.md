# Roadmap

**Qué responde este documento**

- En qué fase va Pulso y qué falta en cada repo
- Cuándo se crea cada cuenta y cuánto cuesta
- Qué se recorta si vamos tarde

Este es el roadmap maestro del producto. Las tareas marcadas **[app]** se hacen en este repo. Las marcadas **[api]** son un resumen: su detalle, con horas y criterios, está en `pulso-api/docs/roadmap.md`.

**Estado actual:** fase 0, semana 1. Planes detallados:
- `docs/plans/2026-10-19-fase-0-registrador.md` (app)
- `pulso-api/docs/plans/2026-10-19-fase-0-clasificador.md` (api)

**Supuestos:** 10 a 12 horas por semana (~11), de lunes a domingo. La fecha que manda es el envío de la prueba cerrada a revisión el 18 o 19 de noviembre (D-022). Meta en Play: ~15 de diciembre, con unos 6 días de colchón antes del 21.

**Costo total del proyecto: USD 25** (Play Console, una vez). Todo lo demás corre en planes gratuitos que no piden tarjeta (D-021).

Cada fase tiene su plan detallado en el `docs/plans/` de cada repo, escrito al empezar la fase: las fases 2 a 4 dependen de lo que mida el registrador.

## Calendario

| Semana | Fechas | Fase | Hito |
| --- | --- | --- | --- |
| S1 | 19 al 25 oct | 0a · Registrador y contrato | El Xiaomi guarda snapshots reales; el contrato de eventos existe en `pulso-api` |
| S2 | 26 oct al 1 nov | 0b · Mecanismos y clasificador | APK en 3 o más teléfonos; clasificador testeado; Play Console pagada |
| S3 | 2 al 8 nov | 1 · API en staging | `POST /v1/events` idempotente en staging, con Supabase y Hyperdrive |
| S4 | 9 al 15 nov | 2a · Subida, decisión y onboarding | Los eventos del Xiaomi llegan a staging; D-012 tomada |
| S5 | 16 al 22 nov | 2b · App usable y comienzo de la fase 3 | **Prueba cerrada enviada a revisión** (18 o 19 nov) |
| S6 | 23 al 29 nov | 3 · Familia, push y UPS | 15 o más testers inscritos; actualización 1 (~27 nov) |
| S7 | 30 nov al 6 dic | 4 · Robustez | Actualización 2 (~4 dic); 14 días cumplidos (~5 dic); solicitud enviada |
| S8 | 7 al 13 dic | 5 · Producción | Aprobación (~12 dic); lanzamiento escalonado |
| S9 | 14 al 21 dic | 5 · Colchón | **Pulso en Google Play** (~15 dic) |

## Cuentas, justo a tiempo (D-011)

| Cuenta | Cuándo | Costo | Para qué |
| --- | --- | --- | --- |
| GitHub (repos públicos `pulso-app` y `pulso-api`) | S1, día 1 | USD 0 | Código, CI ilimitado en repos públicos y respaldos cifrados |
| Google Play Console | S2, antes del 31 oct | **USD 25, una vez** | La verificación tarda días y la necesitamos en S5 |
| Google Group `pulso-testers` | S2 | USD 0 | Lista de la prueba cerrada |
| Cloudflare | S3 | USD 0, sin tarjeta | Workers, Hyperdrive, Rate Limiting, crons |
| Supabase (2 proyectos: staging y producción) | S3 | USD 0, sin tarjeta | PostgreSQL |
| UptimeRobot | S4 | USD 0 | Aviso al teléfono si la API cae |
| Expo (EAS) | S5 | USD 0 | Builds AAB, push y EAS Update |
| Firebase (FCM) | S5 | USD 0 | Credenciales FCM V1 para Expo Push |
| Sentry | S7 | USD 0 | Errores de la app y de la API |

Opcional: un dominio propio (~USD 12 al año) si quieres una URL más presentable que `*.workers.dev` en el portafolio. No bloquea nada.

## Fase 0 · Registrador y clasificador (S1 y S2, ~22 h)

Objetivo: tener datos reales de cortes desde la primera semana y un clasificador testeado antes de escribir pantallas.

- [x] [app] Repo, Expo SDK 58 en el Xiaomi, Biome, Jest y CI (2 h)
- [ ] [app] Módulo `power-monitor`: lector de snapshot, almacén SQLite y envoltorio JS validado (3 h)
- [ ] [app] Mecanismos A, B, arranque y seguimiento de transición (3 h)
- [ ] [app] Mecanismos C y D, con interruptor en la pantalla de registro (2,5 h)
- [ ] [app] Huella de la red de casa, diagnóstico, botones de verdad y exportar (2 h)
- [ ] [app] APK release en el Xiaomi, el Samsung y 1 o 2 teléfonos de la familia (1 h)
- [ ] [api] Repo, contrato de eventos, clasificador (base, UPS, reportes, confirmaciones), resumen por día y `pnpm spike:analyze` (8,5 h)
- [ ] Cuenta de Play Console pagada y en verificación
- [ ] Google Group creado y primer mensaje de reclutamiento

**Lista cuando:** 3 o más teléfonos registran con los cuatro mecanismos, y un exporte real pasa por `pnpm spike:analyze` en `pulso-api`.

## Fase 1 · API en staging (S3, ~11 h)

- [ ] [api] Cloudflare y Supabase, esquema `app` con RLS, funciones de ingesta, auth y latido en una consulta, `devices`, `homes`, `POST /v1/events`, `GET /v1/homes/me/status`, `openapi.json`, test de contrato y deploy a staging (10 h)
- [ ] [app] `pnpm api:generate` con `@hey-api/openapi-ts` y `api/client.ts` (base URL, token, timeouts) (1 h)

**Lista cuando:** reenviar el mismo lote a staging devuelve `duplicated` igual al número de eventos.

## Fase 2a · Subida, decisión y onboarding (S4, ~10 h)

- [ ] [app] Registro del dispositivo al primer arranque y token a la bóveda nativa (Keystore) (1,5 h)
- [ ] [app] `UploadWorker` en Kotlin: red requerida, backoff, jitter, solo cambios de estado, latido vacío; el esquema nativo se reemplaza por el generado (1,5 h)
- [ ] [app] **D-012** con 5 o más cortes reales en 2 o más teléfonos; borrar los mecanismos descartados del código y del manifiesto (1,5 h)
- [ ] [app] Onboarding: vigilar o solo seguir, permiso de notificaciones, guía de batería por fabricante, aprender la red de casa (3 h)
- [ ] [api] `GET /v1/homes/me/outages`, `/privacidad`, `/borrar-datos`, producción y respaldo nocturno (2,5 h)

**Lista cuando:** un corte simulado con `adb` en el Xiaomi aparece en `GET /v1/homes/me/status` de staging, y `/privacidad` de producción carga.

## Fase 2b · App usable (S5, primera mitad, ~5,5 h)

- [ ] [app] Pantallas en modo oscuro por defecto (3 h):
  - Estado: estado del servidor, estado crudo del teléfono y reporte de un toque
  - Historial: semana por día y total
  - Ajustes: alias, diagnóstico, privacidad y borrar datos
- [ ] [app] Expo/EAS: `eas.json` con perfiles `development`, `preview` y `production`, y `EXPO_PUBLIC_API_URL` por perfil (1 h)
- [ ] [app] Play: app creada, prueba interna, ficha, capturas y formularios (1,5 h)
- [ ] **Prueba cerrada enviada a revisión** (18 o 19 nov)

**Lista cuando:** la prueba cerrada está en revisión y la prueba interna corre en el Xiaomi y el Samsung contra producción.

## Fase 3 · Familia, push y UPS (S5, segunda mitad, y S6, ~13 h)

- [ ] [api] Módulo de push, reglas de inicio, regreso, resumen tardío y confirmación; seguir casas, regenerar código, `/c/:code` y `assetlinks.json` (6 h)
- [ ] [app] Modo UPS en el onboarding y en ajustes, con el mecanismo que decidió D-012 (1,5 h)
- [ ] [app] Firebase + FCM V1 en EAS; registro del push token (1 h)
- [ ] [app] Confirmación con botones Sí y No que guarda un evento `confirmation` (1 h)
- [ ] [app] Familia: compartir el enlace por WhatsApp, seguir con código, casas que sigo, dejar de seguir, regenerar código (2,5 h)
- [ ] [app] Actualización 1 publicada en la pista cerrada y anunciada a los testers (1 h)

**Lista cuando:** un corte simulado en el Xiaomi llega como push al Samsung que sigue la casa, y `/c/:code` muestra "Se fue la luz a las…".

## Fase 4 · Robustez (S6 y S7, ~11,25 h)

- [ ] [api] "Sin noticias", `sin_datos`, retención, Sentry, ajuste de umbrales con un test por caso y primera restauración probada (4,5 h)
- [ ] [app] Sentry, con source maps de EAS y los filtros de `docs/security-privacy.md` (0,75 h)
- [ ] [app] Aviso en Estado si la detección está en riesgo: bucket `rare` o `restricted`, optimización de batería activa o latido viejo (2 h)
- [ ] [app] Historial: barras por día y comparación con la semana anterior (1,5 h)
- [ ] [app] Estados vacíos, de error y sin red; textos y accesibilidad básica (1,5 h)
- [ ] [app] Actualización 2 publicada (1 h)

**Lista cuando:** apagar el Wi-Fi y los datos del Xiaomi durante 45 minutos deja la casa en "sin noticias" en el Samsung, y volver a conectarlos la regresa al estado correcto.

## Fase 5 · Producción (S7 a S9)

- [ ] Revisión de seguridad y rendimiento de los dos repos (skill `security-perf-review`)
- [ ] [api] Confirmar los límites gratuitos; `docs/runbook.md`; despliegue final a producción
- [ ] **D-013** con los datos de la prueba
- [ ] Solicitud de acceso a producción con datos concretos
- [ ] Ficha final con capturas reales; READMEs de los dos repos listos para el portafolio
- [ ] Lanzamiento escalonado: 20%, y 100% tras 48 h limpias en Sentry
- [ ] **Hito: Pulso en Google Play**

## Si vamos tarde, se recorta en este orden

1. Barras del historial → lista de texto
2. Aviso de "detección en riesgo" en Estado → solo en Ajustes
3. Página `/c/:code` → la familia sigue solo con la app (v1.1)
4. Modo UPS → actualización 2 (afecta al piloto de Yagos Store: avisarles)

Nunca se recortan: la detección, la política de privacidad, el borrado de datos, las confirmaciones ni los respaldos.

## Futuro (sin fecha)

- v1.1: iPhone solo para seguir casas y reportar a mano (misma base de código Expo; cuenta de Apple Developer, USD 99 al año)
- v1.1: mapa colaborativo con ubicación aproximada opcional (antes, revisar el modelo de amenazas)
- v1.1: Web Push para seguir desde el navegador sin instalar nada
- v1.1: landing en Next.js para el portafolio y dominio propio
- Estimación de autonomía del mini UPS durante el corte
- Exportar el historial a PDF
