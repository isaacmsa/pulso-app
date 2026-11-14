# Fase 10 · Revisión de seguridad

**Qué responde este documento**

- Qué se revisa en los dos repos antes de que entren usuarios reales
- Qué hallazgos dejaron aparcados las revisiones anteriores
- Por dónde sigue la próxima sesión

| | |
| --- | --- |
| Se trabaja en | `pulso-api` y `pulso-app`. Se puede partir en dos sesiones, una por repo |
| Depende de | La fase 7 para revisar el backend y la fase 9 para revisar la app: así no se revisa código que todavía va a cambiar. Si la fase 8 borra mecanismos después, ese cambio se revisa aparte |
| Puede ir a la vez que | La toma de datos de la fase 8. La sesión del backend puede ir a la vez que la fase 9 |
| Trabajo estimado | 5 a 8 horas entre los dos repos (estimación, sin medir) |
| Viene de | Tarea 5.1 de los dos planes y los menores que las revisiones de fase dejaron para después |

El estado de la fase está en el tablero, `docs/roadmap.md`.

## Siguiente paso

Con la fase 7 cerrada: correr la skill `security-perf-review` sobre `pulso-api`, empezando por el aislamiento del esquema `app` y las rutas públicas.

## Lista cuando

- Los hallazgos críticos e importantes de los dos repos están corregidos, cada uno con su test.
- Cada aparcado de las listas de abajo tiene una salida: se arregló, se aceptó o pasó a otra fase.

## Lo que necesita de Isaac

- [ ] **Leer la lista de decisiones** que la sesión le deja al cerrar la fase.

## Tareas

Las listas de aparcados se armaron el 13 de noviembre con las bitácoras de las revisiones y la lectura del código. Confirmar cada punto al abrirlo.

### Revisión

- [ ] `pulso-api`: aislamiento del esquema `app` en Supabase (regla 8), tokens (regla 7), consultas por ruta y CPU con ventanas grandes, `/c/:code`, y comprobar en la plataforma real que los registros de invocación están apagados.
- [ ] `pulso-api`, tres puntos vistos al leer el código: el registro es abierto; probar códigos por `POST /v1/follows` solo lo frena el límite de 120 por minuto por dispositivo; la hora `at` de un evento no tiene tope superior.
- [ ] `pulso-app`: la bóveda del token, la subida, el borrado de datos, los filtros de Sentry y los enlaces `/c/`.
- [ ] Los siete commits del 3 y 4 de noviembre, que entraron después de la última revisión: en la app `4792f5e`, `393662b`, `b74f9e1`, `226da25` y `617fea2`; en el backend `e9ea281` y `a27cc4f`.

### Aparcados del backend

- [ ] Un «No» de confirmación se pierde si el corte cambia de id. El test de `test/integration/push-rules.test.ts` fija el comportamiento actual.
- [ ] Caso raro con dos avisos de fin de un mismo corte: un corte descartado que cubre el momento del push le gana a la continuación viva.
- [ ] El resumen tardío y la pregunta de confirmación no llevan fecha cuando el corte es de otro día (`src/domain/push/messages.ts`). De paso, decidir si la app, la página web y los push usan el mismo formato de fecha, de duración y de mediodía: hoy cada uno tiene el suyo (D-032 en la app, A-035 en el backend).
- [ ] Los errores de envío de push solo van a `console.error`, no a Sentry, y los push tokens con formato malo nunca se limpian.
- [ ] El 429 de `/c/:code` sale en JSON y no en HTML, y la huella de `assetlinks` no valida su formato.
- [ ] En staging, un deploy viejo puede pisar a uno nuevo si su `ci` termina después.
- [ ] `drizzle.__drizzle_migrations` no tiene RLS. El 13 de noviembre se comprobó en staging que `anon` no entra al esquema `drizzle`; decidir si se activa igual.

### Aparcados de la app

- [ ] Un 400 o un 413 descarta el lote entero, hasta 200 eventos, y solo se ve en Diagnóstico: nada lo reporta fuera del teléfono.
- [ ] Deduplicar confirmaciones por corte: la app solo evita repetidos en memoria.
- [ ] Hilos sueltos sin captura de errores en C, en D y en los receivers; `startForeground` sin protección si D se queda.
- [ ] La bóveda: comprobar en un teléfono los códigos 17 y -33 del Keystore y poner tope a las lecturas pasajeras seguidas.
- [ ] Menores de Kotlin que anotó la revisión del 13 de noviembre, sin confirmar: el último snapshot subido se elige por su hora, así que un salto del reloj hacia atrás puede dejar un cambio sin subir; `ApiConfig.appVersion` se guarda y nadie lo lee; `recordSnapshot` acepta cualquier `source` desde JS; y los exportes se acumulan en el caché hasta «Borrar mis datos».

## Apuntes

- Si el borrado de mecanismos de la fase 8 llega después de esta revisión, ese cambio se revisa aparte antes de construir el AAB de la fase 11. El aparcado de `startForeground` solo aplica si D se queda.
- El plan anterior ponía esta revisión justo antes de pedir producción. Va antes del envío de la prueba cerrada porque desde ese día hay testers reales usando producción.
- Revisiones de fase ya hechas: en la app, la 0, el bloque 1 a 2b y el bloque 3 y 4; en el backend, de la 0 a la 4.
- El `README.md` del backend enlaza a la app con una ruta local que no sirve en GitHub. Se arregla en la fase 13, con los README del portafolio.

## Bitácora

- 13 nov 2026 · Fase creada al reorganizar el plan (D-046). Nada empezado.
