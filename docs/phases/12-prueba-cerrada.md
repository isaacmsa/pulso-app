# Fase 12 · Prueba cerrada: 14 días con testers

**Qué responde este documento**

- Qué hay que cumplir durante los 14 días para poder pedir producción
- Qué traen las dos actualizaciones
- Cómo se ajustan los umbrales del detector con las respuestas de los testers (D-013)

| | |
| --- | --- |
| Se trabaja en | `pulso-app` y `pulso-api` |
| Depende de | La fase 11: la prueba cerrada aprobada por Google |
| Puede ir a la vez que | Nada: es la única fase abierta en esos días |
| Trabajo estimado | 5 a 8 horas repartidas en los 14 días (estimación, sin medir) |
| Viene de | Actualizaciones 1 y 2 del plan de la app, tarea 4.4 del backend (D-013, corte B7) y la rutina mensual del runbook |

El estado de la fase está en el tablero, `docs/roadmap.md`.

## Siguiente paso

El día que Google apruebe la prueba cerrada: mirar en Play Console cuántos testers se inscribieron y anotar en «Bitácora» la fecha en que hubo 12. Desde ahí corren los 14 días.

## Lista cuando

- Pasaron 14 días seguidos con 12 o más testers inscritos.
- Hay dos actualizaciones publicadas en la pista cerrada.
- D-013 está registrada en `docs/decisions.md` con sus datos.

## Lo que necesita de Isaac

- [ ] **Cuidar a los testers:** grupo de WhatsApp, dos o tres preguntas por semana y que nadie se salga. Si bajan de 12, los 14 días empiezan de nuevo.
- [ ] **C7 · Publicar la actualización 1** en la pista cerrada, hacia el día 6.
- [ ] **B7 · Correr la consulta de confirmaciones** (`pulso-api/scripts/spike/confirmations.sql`) en el SQL Editor de producción hacia el día 10 y pasar el JSON.
- [ ] **C7 · Publicar la actualización 2**, hacia el día 13.

## Tareas

- [ ] Anotar cada semana en «Bitácora» qué reportaron los testers: es lo que pide el cuestionario de producción de la fase 13.
- [ ] Actualización 1: los arreglos de lo que digan los testers y lo que quedó de «Pulido» de la fase 6. Aviso para el grupo de WhatsApp.
- [ ] Herramienta para leer el JSON de confirmaciones: hoy `pnpm spike:analyze` solo acepta el formato del exporte del registrador.
- [ ] D-013: con las confirmaciones, decidir `MIN_OUTAGE_MS` (hoy 10 min) y `TRANSITION_MS` (hoy 3 min). Si cambia un umbral, un test por caso real (regla 1 del backend); si no cambia, anotar por qué. La tolerancia de 5 minutos de las confirmaciones está escrita además a mano, como `300000`, en `pulso-api/drizzle/0001_ingest_functions.sql` y `0004_staleness.sql`: si se toca, va en una migración nueva.
- [ ] Actualización 2: los umbrales y los arreglos que falten. Aviso para el grupo.
- [ ] Mirar los errores de Sentry y el monitor de la API cada pocos días, y hacer la restauración mensual del runbook.
- [ ] Con los datos de los testers: ver si el aviso de «detección en riesgo» acierta en Samsung, Tecno e Infinix (D-038 lo dejó como apuesta).

## Decisiones abiertas

| Decisión | Por qué importa | Si Isaac no decide |
| --- | --- | --- |
| ¿Qué dice una casa que vuelve de «sin noticias»? | Viene de la fase 7. Hoy dice «Hay luz desde» la hora del latido, aunque la luz nunca se fue, y los testers lo van a ver | Se queda así en la v1 |

## Apuntes

- Las confirmaciones solo existen si el push funciona: a un teléfono sin push token no se le piden. Si al día 10 hay pocas respuestas, D-013 se toma con lo que haya y se anota.
- En el modo UPS, desenchufar un teléfono bloqueado abre un corte falso y a los 10 minutos avisa a la familia; la confirmación recién se pide cuando el corte se cierra. Es el costo que aceptó D-044: contar cuántas veces pasa.
- Google espera ver cambios reales durante la prueba. Salen de los arreglos por lo que digan los testers y del ajuste de umbrales.
- La fase 0 del backend dejó cinco preguntas de producto del clasificador (20 de octubre), que estaban en una nota fuera del repo. No se revisó si alguna se resolvió después; mirarlas al tocar umbrales:
  - Un «sin luz» manual durante la transición del modo base convierte un futuro corte `alta` en `manual`, que solo se cierra al volver la corriente y no recibe la pregunta de confirmación.
  - En modo UPS, desenchufar con la pantalla encendida y que el Wi-Fi caiga en menos de 3 minutos abre un corte `alta` por la regla base.
  - En modo UPS, enchufar el teléfono en otra red cierra el corte como `cerrado`: la regla del enchufe va antes que la de «otra red».
  - En modo base, la hora del enchufe también se guarda estando en otra red y puede terminar como fin del corte.
  - Un «Sí» sobre un corte `descartado` lo deja `descartado` con `confirmed: true`; un «No» sobre uno `abierto` lo deja `descartado` sin hora de fin.

## Bitácora

- 13 nov 2026 · Fase creada al reorganizar el plan (D-046). Espera a la fase 11.
