# Fase 7 · API en producción con respaldo

**Qué responde este documento**

- Qué falta para que exista `https://pulso-api.isaac-mendozasa.workers.dev`
- Qué pasos de producción ya dio Isaac y cuáles le quedan
- Cómo se comprueba el primer deploy, el primer respaldo y la primera restauración

| | |
| --- | --- |
| Se trabaja en | `pulso-api`, rama `main`. De `pulso-app` solo toca el cliente generado (`src/shared/api/generated/`), este archivo y su fila del tablero |
| Depende de | Nada |
| Puede ir a la vez que | Las fases 6 y 8 |
| Trabajo estimado | 3 a 4 horas, más unos 45 minutos de Isaac (estimación, sin medir) |
| Viene de | Fase 2 del backend (tarea 2.5, cortes B1, B2 y B3), la restauración (B8), Sentry (B6) y lo que quedó de la fase 1 |

El estado de la fase está en el tablero, `pulso-app/docs/roadmap.md`. Las rutas de este archivo son de `pulso-api`, salvo las que empiezan por `pulso-app/`.

## Siguiente paso

Mientras Isaac da sus pasos 5 a 8, la sesión adelanta «Antes del deploy»: los textos de la política y los arreglos chicos del contrato y de los documentos. Con el `id` de Hyperdrive en la mano, sigue por «Deploy».

## Lista cuando

- `/health`, `/privacidad` y `/borrar-datos` de producción responden 200.
- El respaldo nocturno terminó en verde y dejó su artefacto.
- Hay una restauración anotada en la tabla de `docs/runbook.md`.

## Lo que necesita de Isaac

Nada cuesta dinero. Los pasos 1 a 4 ya están hechos y se comprobaron el 13 de noviembre: el proyecto de Supabase `pulso` en `us-east-1`, el rol `pulso_api` con permiso de crear, y el Environment `production` de GitHub con revisor obligatorio, solo `main` y su `PRODUCTION_DATABASE_URL`. El host del pooler de sesión de producción lo pasó Isaac el 10 de noviembre: `aws-0-us-east-1.pooler.supabase.com`.

- [ ] **Paso 5 · Hyperdrive `pulso`.** Crearlo desde el panel de Cloudflare (Storage & Databases > Hyperdrive > Create), para que la contraseña no quede en el historial de la terminal. Conexión directa: host `db.<ref>.supabase.co`, puerto 5432, base `postgres`, usuario `pulso_api`. Caché desactivada (A-015). Pasar el `id`.
- [ ] **Paso 6 · `TOKEN_SIGNING_KEY` de producción**, con un valor nuevo, nunca el de staging. Guardarlo en el gestor de contraseñas: si se pierde o se rota, todos los teléfonos se registran de nuevo y pierden su casa.

  ```bash
  openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
  ```

  ```bash
  pnpm exec wrangler secret put TOKEN_SIGNING_KEY --env production
  ```

- [ ] **Paso 7 · Par de claves `age`.** La privada se queda en su equipo y en su gestor, nunca en GitHub. Pasar la línea `# public key: age1…`, que es pública.

  ```bash
  age-keygen -o ~/pulso-backup-key.txt
  ```

- [ ] **Paso 8 · Environment `backup` de GitHub.** Ya existe, con la regla de solo `main`. Cargarle `PRODUCTION_DATABASE_URL` (el mismo valor que tiene el Environment `production`) y `BACKUP_AGE_RECIPIENT` (la clave pública del paso 7). Sin revisores, o el respaldo de cada noche esperaría un clic.
- [ ] **B3 · Aprobar el deploy** en Actions > `deploy-production`.
- [ ] **B8 · Restaurar un respaldo** con su clave privada (`scripts/backup/restore-local.sh`) y decir cuánto tardó.
- [ ] **Panel de Hyperdrive:** mirar que un latido gasta una sola consulta. Quedó abierto de la fase 1.
- [ ] **B6 · Sentry y UptimeRobot** (gratis): crear el proyecto de Sentry del backend y cargar `SENTRY_DSN` en los dos entornos; crear el monitor de `/health` de producción cada 5 minutos. Tiene que estar antes del AAB de la fase 11: sin esto un error en producción solo se ve entrando a los logs, y la fase 13 pide 48 horas limpias en Sentry.

## Tareas

### Antes del deploy

Estos commits se suben a `main` con el visto bueno de Isaac: ese push despliega staging, no producción.

- [ ] Política `/privacidad` (`src/modules/pages/privacy.tsx`): dice «regenéralo en Ajustes» y el botón está en la pestaña Familia. Los documentos de la app que dicen lo mismo los corrige la fase 6.
- [ ] Política: nombrar que se guarda si el teléfono está bloqueado (`locked`, A-050), según lo que Isaac decida abajo, y actualizar su fecha: `LAST_UPDATE` en `src/modules/pages/layout.tsx` dice 23 de octubre y también fecha `/borrar-datos`.
- [ ] Contrato: declarar la respuesta 413 que el código ya devuelve (`src/middleware/json-body.ts`). Es aditivo: `pnpm openapi:export` aquí y, con staging desplegado, `pnpm api:generate` en la app.
- [ ] `docs/decisions.md`: falta la fila A-036 (seguir es idempotente, tope de 20 casas), que citan `docs/api.md` y el código. Un comentario de `src/modules/push/repo.ts` cita A-045 donde es A-047.
- [ ] `docs/architecture.md` y `docs/data-model.md`: detalles viejos (el orden de pasos de `POST /v1/events`, `drizzle-kit migrate`, la caché de Hyperdrive y dos números de decisión mal puestos).

### Deploy

- [ ] Poner el `id` de Hyperdrive en `env.production` de `wrangler.jsonc` y anotar la región y el host del pooler de producción (ampliar A-026). Commit `chore: hyperdrive de producción`.
- [ ] Antes de lanzar, leer «Producción» y «Volver atrás» de `docs/runbook.md`. Después, push de `main` y `deploy-production` con la aprobación de Isaac: aplica las migraciones 0000 a 0004 y despliega de una vez todo lo de las fases 1 a 4.
- [ ] Comprobar: `/health` da `{"ok":true}`; `/privacidad` y `/borrar-datos` dan 200; `/docs` da 404; un token inventado da 401; las tablas de `app` existen con RLS y dueño `pulso_api`; `anon` no lee `app.homes`.
- [ ] Anotar las URL de `/privacidad` y de `/borrar-datos` en «Apuntes» de la fase 11.

### Respaldo y restauración

- [ ] Correr `backup` a mano y ver el artefacto `pulso-AAAAMMDD.dump.age` de más de 1 KB. Al día siguiente, confirmar que el nocturno pasó. Hasta que estén los secretos del paso 8 falla cada noche: lo hace desde el 24 de octubre.
- [ ] Con la restauración de Isaac (B8), llenar la fila de la tabla de `docs/runbook.md`: fecha, artefacto, tamaño y duración.

### Si Isaac crea las cuentas de B6

- [ ] Con el DSN cargado: medir la CPU que suma el envoltorio de Sentry (el plan gratuito da 10 ms por petición), activar en Sentry «Prevent storing IP addresses» y configurar `release`.

## Decisiones abiertas

| Decisión | Por qué importa | Si Isaac no decide |
| --- | --- | --- |
| ¿La política nombra el dato `locked`? | Play compara la política con el formulario de seguridad de datos. Hoy dice «la pantalla y la batería» | Se agrega «y si el teléfono está bloqueado» |
| ¿«Sin luz» se muestra desde que abre el corte o a los 10 minutos? | `pulso-app/docs/product.md` dice a los 10 minutos. El servidor lo muestra desde el inicio del corte y lo descarta si dura menos (`src/domain/detection/home-status.ts`): la familia puede ver un «Se fue la luz» que después desaparece | Se queda como está el código y la fase 6 corrige `product.md` |
| ¿Qué dice una casa que vuelve de «sin noticias»? | Hoy el servidor pone «con luz» desde la hora del latido (A-037) y la app muestra «Hay luz desde» esa hora, aunque la luz nunca se fue | Se queda así y se decide en la fase 12 con lo que digan los testers |
| ¿El fixture con horas reales se queda así? | `test/fixtures/real/redmi-a5-2026-11-03-ups.json` tiene las horas verdaderas del 3 y 4 de noviembre en un repo público. A-023, en su última parte, pide publicar los exportes reales movidos en el tiempo con `pnpm fixtures:shift` | Se queda: las mismas horas ya están en D-044 |

## Apuntes

- La política dice que Sentry recibe los errores y que GitHub guarda respaldos cifrados. Ninguna de las dos cosas corre todavía: por eso los pasos 7 y 8 van junto con el primer deploy.
- Supabase pausa un proyecto gratuito tras una semana sin actividad. `pulso` se creó el 9 de noviembre y no recibe tráfico hasta el primer deploy; el 14 de noviembre seguía activo. Si aparece pausado: `docs/runbook.md`, «Reactivar un proyecto pausado».
- El plan gratuito de Cloudflare da 5 Cron Triggers por cuenta y Pulso usa 4 (dos por entorno). El 13 de noviembre la cuenta solo tenía el Worker `pulso-api-staging`.
- Del «Lista cuando» de la fase 1 tampoco quedó anotado el reenvío de un mismo lote a staging con `duplicated` igual al número de eventos. Comprobar si basta con los tests de `test/integration/events.test.ts`.
- El resumen tardío y la pregunta de confirmación no llevan fecha cuando el corte es de otro día, y el 429 de `/c/:code` sale en JSON. Están en la lista de la fase 10.

## Bitácora

- 13 nov 2026 · Fase creada al reorganizar el plan (D-046). Comprobado ese día: los pasos 1 a 4 están hechos; no existe el Hyperdrive de producción ni el Worker `pulso-api`; la base de producción no tiene tablas; el Environment `backup` no tiene secretos; producción responde 404.
