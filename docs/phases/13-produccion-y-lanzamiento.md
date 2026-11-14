# Fase 13 · Producción y lanzamiento

**Qué responde este documento**

- Qué se le entrega a Google para pedir el acceso a producción
- Cómo se hace el lanzamiento escalonado
- Qué tiene que quedar listo para el portafolio

| | |
| --- | --- |
| Se trabaja en | `pulso-app` y `pulso-api` |
| Depende de | La fase 12: los 14 días cumplidos |
| Puede ir a la vez que | Nada |
| Trabajo estimado | 3 a 5 horas (estimación, sin medir) |
| Viene de | Fase 5 de los dos planes (tareas 5.2 a 5.5, cortes C7, C8, B3 y B9) |

El estado de la fase está en el tablero, `docs/roadmap.md`.

## Siguiente paso

Con los 14 días cumplidos: redactar las respuestas del cuestionario de producción con lo anotado en la bitácora de la fase 12.

## Lista cuando

- Pulso está en Google Play al 100%, con 48 horas sin errores graves en Sentry.
- Los README de los dos repos están listos para el portafolio.
- El tablero tiene todas las fases en `Hecha`.

## Lo que necesita de Isaac

- [ ] **C7 · Enviar la solicitud de acceso a producción.**
- [ ] **B9 · Pasar un exporte del teléfono** con la versión que va a producción.
- [ ] **B3 · Aprobar el deploy final** de la API.
- [ ] **C8 · Lanzar al 20%** y, tras 48 horas limpias, al 100%.

## Tareas

- [ ] Respuestas del cuestionario con datos concretos: cuántos testers hubo, qué reportaron y qué cambió en cada actualización.
- [ ] Reconciliar el formulario de seguridad de datos con lo que trae esa versión (D-034): si el push o Sentry no entraron, se quitan el token push y los registros de fallos.
- [ ] Lote real de la versión de producción en `pulso-api/test/fixtures/batches/` (regla 5), armado desde el exporte de Isaac como el de la fase 11.
- [ ] Deploy final de la API con sus comprobaciones: `/health`, `/privacidad`, `/openapi.json`, un registro de prueba que después se borra, que `sweep` corrió y que existe el respaldo de anoche.
- [ ] El botón «Abrir en Pulso» de `/c/:code` lleva a la ficha de Play cuando la app no está instalada. Hoy recarga la misma página (A-048).
- [ ] Ficha final con las capturas finales.
- [ ] README de los dos repos para el portafolio, con la tabla de evidencia de `docs/product.md`. El del backend enlaza a la app con una ruta local que no sirve en GitHub.
- [ ] Cierre: todas las casillas marcadas y el tablero en `Hecha`.

## Apuntes

- GitHub desactiva los workflows programados de un repo público tras 60 días sin actividad: después del lanzamiento el respaldo puede apagarse sin aviso. Está en la rutina mensual de `pulso-api/docs/runbook.md`.
- La evidencia que el proyecto tiene que dejar está en «Objetivo del proyecto» de `docs/product.md`.

## Bitácora

- 13 nov 2026 · Fase creada al reorganizar el plan (D-046). Espera a la fase 12.
