# Producto

**Qué responde este documento**

- Qué problema resuelve Pulso y para quién
- Qué ve cada persona, incluso cuando no hay datos
- Qué entra en la prueba cerrada, qué llega como actualización y qué queda para después
- Cómo funciona el piloto con Yagos Store

## Objetivo del proyecto

Pulso es un proyecto de portafolio para roles mobile cross-platform y full stack (D-020). Tiene que demostrar que una sola persona lleva una app a producción y la opera. La evidencia que debe quedar al final:

| Evidencia | Dónde |
| --- | --- |
| App publicada en Google Play, con testers reales y al menos dos actualizaciones | Ficha de Play y `docs/play-store.md` |
| Un problema difícil resuelto: detección en segundo plano con un módulo nativo en Kotlin, decidida con datos | `docs/detection.md` y D-012 |
| Backend propio serverless (Hono en Cloudflare Workers, PostgreSQL en Supabase) en producción: CI/CD, migraciones, aislamiento de datos, respaldos con restauración probada, monitoreo, a costo cero | `pulso-api/docs/architecture.md` y `pulso-api/docs/runbook.md` |
| Contrato tipado de punta a punta (OpenAPI → cliente generado) y tests del clasificador con datos reales | Los dos repos |
| Decisiones documentadas con sus trade-offs | `docs/decisions.md` y `pulso-api/docs/decisions.md` |
| Repos públicos con README claros | GitHub |

## El problema

En Venezuela los cortes de luz son diarios en varias regiones y no hay un cronograma oficial. Los mapas de cortes que existen dependen de que la gente reporte a mano. Pulso detecta el corte de forma automática con el teléfono que ya está enchufado en casa: cuando se va la luz, el teléfono deja de cargar y el router se apaga.

## Usuarios

| Usuario | Qué necesita | Cómo usa Pulso |
| --- | --- | --- |
| Quien vive en la casa | Saber desde cuándo no hay luz y cuántas horas se ha ido esta semana | Deja un Android enchufado con Pulso en modo "vigilar mi casa" |
| Familia que sigue la casa (dentro o fuera del país) | Enterarse cuando se va y cuando vuelve la luz sin llamar | Con Android: la app en modo "solo seguir" y recibe push. Con iPhone o sin la app: abre el enlace que le mandaron por WhatsApp |
| Clientes de Yagos Store con mini UPS en el router | Lo mismo, aunque su Wi-Fi siga funcionando durante el corte | Activan "Mi router tiene UPS" en el onboarding |

Pulso no tiene cuentas de usuario. Cada teléfono recibe un identificador anónimo y un token. Una casa se sigue con un código corto que se comparte por WhatsApp.

## Qué ve la familia

Lo que sabe el servidor depende de si el teléfono de la casa puede avisar. Cuando se va la luz también se cae el router, así que el aviso en vivo solo sale si el teléfono tiene datos móviles. Pulso lo dice tal cual, sin adivinar:

| Estado | Cuándo | Qué dice |
| --- | --- | --- |
| Con luz | El teléfono está en corriente y mandó su latido hace menos de 40 minutos | "Hay luz desde las 2:30 p. m." |
| Sin luz | Hay un corte abierto de 10 minutos o más | "Se fue la luz a las 6:05 p. m. (1 h 20 min)" |
| Sin noticias | Pasaron 40 minutos sin latido y no hay un corte abierto. Puede ser un corte sin datos móviles, el teléfono apagado o el fabricante matando la app | "Sin noticias de la casa desde las 7:10 p. m." |

Cuando vuelve la luz y el teléfono sube lo que guardó, el historial queda con la hora real del corte, aunque el aviso no haya salido a tiempo.

Quien vive en la casa, sin red, ve el estado crudo de su propio teléfono ("Sin corriente desde las 6:05 p. m.") junto al último estado que dio el servidor, con su hora. Quien decide si hubo un corte es solo el servidor (D-016).

## Alcance

| Funcionalidad | Prueba cerrada (19 nov) | Actualizaciones durante la prueba | v1.1 | Más adelante |
| --- | --- | --- | --- | --- |
| Detección automática de cortes en casa | Sí | Ajuste de umbrales con las confirmaciones | | |
| Modo router con UPS | | Actualización 1 (~27 nov), experimental | Mejoras con los datos del piloto | |
| Reporte manual de un toque: hay luz, fluctuando, sin luz | Sí | | | |
| Historial y horas sin luz por semana | Sí, lista por día | Barras por día y comparación con la semana anterior | Gráfica mensual | Exportar a PDF |
| Diagnóstico de la detección (batería, fabricante, último latido) | Sí, en ajustes | Aviso en la pantalla principal si la detección está en riesgo | | |
| Borrar todos mis datos | Sí | | | |
| Push de corte y regreso | | Actualización 1 (~27 nov) | | |
| Confirmación "¿Se fue la luz de 6:05 a 8:10?" | | Actualización 1 | | |
| Seguir una casa con código (app y enlace web) | | Actualización 1 | | |
| Estado "sin noticias" | | Actualización 2 (~4 dic) | | |
| iPhone | No | | Solo seguir una casa | |
| Web Push para seguir desde el navegador | No | | Evaluar | |
| Mapa colaborativo por zona | No | | Con ubicación aproximada opcional | Pronóstico por zona |
| Cuentas, contraseñas, pagos | No | No | No | |

La prueba cerrada arranca con lo que genera datos (detección, estado, historial, reportes). La parte de familia llega como primera actualización: así hay un cambio real durante la prueba, que es lo que Google espera ver.

## Piloto con Yagos Store

- La prueba cerrada exige al menos 12 testers inscritos durante 14 días seguidos. Se reclutan 20 entre clientes y seguidores de Yagos Store (@yagostore.ve), familia y amigos en Maracay y Valencia. Detalles en `docs/play-store.md`.
- Muchos clientes de Yagos Store tienen el router en un mini UPS. Por eso el modo UPS llega en la primera actualización de la prueba (una semana después de que se inscriban), aunque sea experimental: sin él, el piloto no vería sus cortes. Avisarles al reclutarlos.
- Los botones "Se fue la luz" / "Volvió" y las confirmaciones de los testers son los datos para ajustar el detector.
- Ideas para v1.1, sin compromiso: estimar cuánto le queda al mini UPS según el tiempo que lleva el corte, y un enlace a la tienda en el historial. Revisar las políticas de Google Play antes de enlazar ventas.

## Fuera de alcance

- Pronóstico de cortes por zona y venta de datos a empresas: hacen falta muchos usuarios por zona.
- Monetización: Pulso es un proyecto de portafolio (ver "Objetivo del proyecto").
- App web aparte: la API sirve solo dos páginas (`/privacidad` y `/c/:code`). Ver D-006 en `docs/decisions.md`.
