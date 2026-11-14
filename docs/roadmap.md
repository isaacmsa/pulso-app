# Roadmap

**Qué responde este documento**

- En qué estado está cada fase de Pulso y qué espera de Isaac
- En qué orden van las fases y cuáles pueden ir a la vez
- Cuánto falta para llegar a Google Play desde que se pague la cuenta
- Cómo se pide el estatus y cómo se continúa una fase en una sesión nueva

Este es el tablero único de los dos repos (`pulso-app` y `pulso-api`). El estado del proyecto vive aquí y en ningún otro documento (D-046). El detalle de cada fase está en su archivo de `docs/phases/`: sus tareas, lo que le toca a Isaac, cómo se sabe que terminó y por dónde seguir.

**Actualizado:** 14 de noviembre de 2026.

**Supuestos:** 10 a 12 horas por semana. El proyecto cuesta USD 25 en total (Play Console, una vez); todo lo demás corre en planes gratuitos que no piden tarjeta (D-021).

## Tablero

| Fase | Estado | Depende de | Espera de Isaac |
| --- | --- | --- | --- |
| 0 a 4 · Construcción | Hecha | — | Nada |
| [6 · Arreglos antes del primer build](phases/06-arreglos-antes-del-build.md) | Lista | — | Tres decisiones que no la frenan |
| [7 · API en producción con respaldo](phases/07-api-en-produccion.md) | Lista | — | Los pasos 5 a 8 de producción (sin costo, unos 45 minutos) y aprobar el deploy |
| [8 · Detección con datos reales](phases/08-deteccion-con-datos-reales.md) | Espera a Isaac | — para juntar datos; la 6 para borrar mecanismos | Exportar el registro del Xiaomi antes del 18 de noviembre, dejarlo enchufado en casa y poner la app en dos teléfonos de la familia |
| [9 · Primer build con EAS y push](phases/09-build-eas-y-push.md) | Bloqueada | 6 | Cuentas de Expo y de Firebase (gratis), un segundo Android y decidir si va EAS Update |
| [10 · Revisión de seguridad](phases/10-revision-de-seguridad.md) | Bloqueada | 7 y 9 | Nada |
| [11 · Play Console y envío de la prueba cerrada](phases/11-play-console-y-prueba-cerrada.md) | Bloqueada | 7, 8, 9, 10 y el pago | Pagar Play Console (USD 25). Reclutar testers se puede empezar ya |
| [12 · Prueba cerrada: 14 días con testers](phases/12-prueba-cerrada.md) | Bloqueada | 11 | Publicar dos actualizaciones y correr una consulta |
| [13 · Producción y lanzamiento](phases/13-produccion-y-lanzamiento.md) | Bloqueada | 12 | Pedir el acceso a producción y lanzar |

Lo único que depende de dinero son las fases 11 a 13. Las fases 6 a 10 se pueden cerrar mientras llega el pago, de modo que el día que la cuenta de Play esté verificada solo falte enviar.

## Orden de las fases

```text
6 ─→ 9 ─┐
7 ──────┴─→ 10 ─┐
8 ──────────────┴─→ 11 ─→ 12 ─→ 13
                    └─ necesita además el pago de Play Console
```

- **6, 7 y 8 pueden ir a la vez**: la 6 toca la app, la 7 el backend y la 8 empieza juntando datos con el teléfono, sin tocar código.
- **6 y 9 van una después de la otra**: las dos editan `app.json`.
- **La 10 se puede partir por repo**: la revisión del backend empieza al cerrar la 7 y la de la app al cerrar la 9.
- **La 8 tiene dos partes**: juntar datos (desde ya, dura días) y decidir D-012 con el borrado de los mecanismos descartados (después de la 6). Tiene que cerrar antes del envío de la fase 11; si ese día no hay datos suficientes, vale D-029.

## Calendario

No hay fechas fijas (D-045): todo cuenta desde el día en que Isaac pague Play Console. Las duraciones son las del calendario anterior y las que publica Google; ninguna depende de nosotros salvo la segunda fila.

| Momento | Qué pasa | Cuánto tarda |
| --- | --- | --- |
| Día del pago | Isaac paga los USD 25 y empieza la verificación de identidad y del teléfono | Días; el plan anterior reservaba unos 10 |
| Cuenta verificada | Se crea la app, se sube el AAB, se llena la ficha y se envía la prueba cerrada (fase 11) | 1 o 2 días |
| Prueba en revisión | Google la aprueba y los testers se inscriben | Unos 3 días |
| 12 testers inscritos | Corren los 14 días seguidos, con dos actualizaciones (fase 12) | 14 días |
| Día 14 | Solicitud de acceso a producción (fase 13) | Hasta 7 días, a veces más |
| Solicitud aprobada | Lanzamiento al 20% y al 100% tras 48 h sin errores graves | 2 o 3 días |

**Pulso llega a Google Play entre 4 y 6 semanas después del pago**, siempre que para ese día estén cerradas las fases 6 a 10 y haya 12 testers listos para inscribirse. La meta anterior del 15 de diciembre ya no vale.

**Trabajo que falta:** las fases 6 a 10 suman entre 23 y 35 horas, o sea de dos a tres semanas y media al ritmo supuesto. Las fases 11 a 13 suman entre 11 y 18 horas, repartidas en las semanas de espera. Son estimaciones del 14 de noviembre, sin medir; la de cada fase está en su archivo.

## Cuentas y costos

Las cuentas se crean cuando hacen falta (D-011). Ya existen las de GitHub (dos repos públicos), Cloudflare y Supabase (proyectos `pulso-staging` y `pulso`). Faltan estas; si ya se creó cada una se marca en el archivo de su fase:

| Cuenta | Costo | Para qué | Fase |
| --- | --- | --- | --- |
| Expo (EAS) | USD 0 | Builds, push y, si se decide, EAS Update | 9 |
| Firebase (FCM) | USD 0 | Credenciales FCM V1 para que Expo entregue los push | 9 |
| Sentry | USD 0 | Errores de la app y de la API | 7 y 9 |
| UptimeRobot | USD 0 | Aviso al teléfono si la API cae | 7 |
| Google Group `pulso-testers` | USD 0 | Lista de la prueba cerrada | 11 |
| Google Play Console | **USD 25, una vez** | Publicar. Al 14 de noviembre no hay fondos para pagarla | 11 |

Opcional: un dominio propio (unos USD 12 al año) para una URL más presentable que `*.workers.dev`. No bloquea nada.

## Cómo se usa este tablero

**Para saber cómo va todo**, en cualquier sesión nueva basta con pedir «estatus». La sesión:

1. Lee este tablero y, de cada fase que no esté `Hecha` ni `Bloqueada`, la sección «Siguiente paso» de su archivo.
2. Comprueba lo barato antes de responder. En cada uno de los dos repos, el último commit, los cambios sin commit y los commits sin subir:

   ```bash
   git log -1 --oneline; git status --short; git log --oneline "origin/$(git branch --show-current)..HEAD"
   ```

   La API, staging primero y producción después:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://pulso-api-staging.isaac-mendozasa.workers.dev/health
   curl -s -o /dev/null -w '%{http_code}\n' https://pulso-api.isaac-mendozasa.workers.dev/health
   ```

   Y, en `pulso-api`, la última corrida de cada workflow:

   ```bash
   for w in ci deploy backup; do gh run list --workflow "$w.yml" --limit 1; done
   ```

   Mientras la fase 7 no esté `Hecha`, producción responde 404 y el respaldo nocturno falla: es lo esperado, no una avería.
3. Responde fase por fase con su estado, su siguiente paso y lo que espera de Isaac. Si el tablero no coincide con lo que ve, lo dice y lo corrige en el archivo; el commit de esa corrección lo decide Isaac.

**Para trabajar una fase**, una sesión por fase: «continúa la fase 7». La sesión:

1. Lee completo el archivo de la fase y empieza por «Siguiente paso». Antes de tocar `pulso-api`, lee su `AGENTS.md`. Si la fase está `Bloqueada` o `Espera a Isaac`, no fuerza tareas: dice qué la frena y, si algo se puede adelantar sin saltarse el orden, lo propone antes de hacerlo.
2. No hace tareas de otra fase. Lo que encuentre fuera de la suya lo anota en «Apuntes» del archivo de la fase que corresponde.
3. Marca cada tarea al terminarla. Una tarea que se descarta o que pasa a otra fase no se deja sin marcar: se mueve a «Apuntes» con su razón. Antes de cerrar reescribe «Siguiente paso» y agrega una línea a «Bitácora» con la fecha, lo que hizo y lo que sigue.
4. Si cambió el estado de la fase, cambia su fila en el tablero y la fecha de «Actualizado». Al cerrar una fase, revisa las que dependían de ella: la que ya no tenga nada pendiente antes pasa a `Lista` o a `Espera a Isaac`.

Los pasos 3 y 4 van en el mismo commit que el trabajo. Si el trabajo es de `pulso-api`, van en un commit de `pulso-app` hecho en el mismo momento, porque el tablero y las fases viven en `pulso-app`. La sesión hace los commits; subirlos espera el visto bueno de Isaac, y en `pulso-api` un push a `main` despliega staging.

La sesión se abre en el repo que dice «Se trabaja en» y siempre necesita además la carpeta de `pulso-app`, donde están el tablero y los archivos de fase.

**Dos fases a la vez** solo cuando sus archivos lo dicen en «Puede ir a la vez que»: dos sesiones nunca editan los mismos archivos, salvo cada una su fila de este tablero. Como comparten la carpeta del repo, cada sesión hace commit solo de sus archivos (`git add <rutas>`, nunca `git add -A`).

| Estado | Qué significa |
| --- | --- |
| Lista | Nadie la ha empezado y una sesión puede empezarla hoy |
| En curso | Ya tiene trabajo hecho y una sesión puede seguir sin esperar a nadie |
| Espera a Isaac | Lo que sigue solo lo puede hacer Isaac, aunque ya tenga trabajo hecho |
| Bloqueada | Depende de otra fase o de un pago |
| Hecha | Cumple su «Lista cuando» y no le quedan casillas |

`pnpm test` falla si el tablero y los archivos de fase dejan de coincidir (`__tests__/roadmap.test.ts`).

## Fases cerradas: construcción (0 a 4)

Entre el 20 de octubre y el 4 de noviembre se escribió y se probó todo el código de la v1 en los dos repos. Cómo se hizo cada cosa está en los planes de `docs/plans/` y de `pulso-api/docs/plans/`, que quedan como registro.

| Fase | Qué quedó construido |
| --- | --- |
| 0 · Registrador y clasificador | Módulo nativo `power-monitor` con los mecanismos A, B, C y D, huella de la red de casa, diagnóstico y exporte. En el backend, el contrato de eventos y el clasificador con sus tests |
| 1 · API en staging | Esquema `app` con RLS, ingesta idempotente, registro, estado de la casa, `openapi.json` y deploy a staging. En la app, el cliente generado |
| 2 · Subida, onboarding y pantallas | Bóveda del token, subida con WorkManager, onboarding, Estado, Historial y Ajustes, perfiles de EAS y textos de la ficha de Play. En el backend, historial, `/privacidad`, `/borrar-datos`, deploy a producción con aprobación y respaldo nocturno (sin estrenar) |
| 3 · Familia, push y UPS | Seguir casas con código, enlace `/c/:code`, avisos de inicio y regreso, confirmación Sí/No y modo UPS |
| 4 · Robustez | «Sin noticias», retención, Sentry apagado hasta tener cuenta, aviso de detección en riesgo, barras del historial y estados vacíos, de error y sin red |

Lo que esas fases dejaron sin cerrar, y la fase 5 del plan anterior (producción), se repartió así:

| Venía de | Qué quedó | Pasó a |
| --- | --- | --- |
| Fase 0 | La app en dos o más teléfonos de la familia y la decisión D-012 | 8 |
| Fase 0 | Play Console pagada y Google Group de testers | 11 |
| Fase 1 | Mirar en el panel de Hyperdrive que un latido gasta una sola consulta | 7 |
| Fase 2 | Producción de la API y primer respaldo | 7 |
| Fase 2 | Primer build con EAS | 9 |
| Fase 2 | App en Play, ficha, formularios y envío de la prueba cerrada | 11 |
| Fase 3 | Credenciales FCM y prueba del push entre dos teléfonos | 9 |
| Fase 3 | Huella de firma para que los enlaces abran la app | 9 y 11 |
| Fases 3 y 4 | Actualizaciones 1 y 2 y ajuste de umbrales (D-013) | 12 |
| Fase 4 | Primera restauración de un respaldo; Sentry y UptimeRobot | 7 y 9 |
| Fase 5 | Revisión de seguridad y rendimiento | 10 |
| Fase 5 | Solicitud de producción, ficha final, READMEs y lanzamiento | 13 |

## Lo que no se recorta

Aunque haya que recortar algo para llegar: la detección, la política de privacidad, el borrado de datos, las confirmaciones y los respaldos se quedan.

El orden de recorte del plan anterior ya no aplica: lo que listaba (las barras del historial, el aviso de detección en riesgo, la página `/c/:code` y el modo UPS) ya está construido.

## Futuro (sin fecha)

- v1.1: iPhone solo para seguir casas y reportar a mano (misma base de código Expo; cuenta de Apple Developer, USD 99 al año)
- v1.1: mapa colaborativo con ubicación aproximada opcional (antes, revisar el modelo de amenazas)
- v1.1: Web Push para seguir desde el navegador sin instalar nada
- v1.1: landing en Next.js para el portafolio y dominio propio
- Estimación de autonomía del mini UPS durante el corte
- Exportar el historial a PDF
