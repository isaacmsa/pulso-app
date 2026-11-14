# Fase 8 · Detección con datos reales

**Qué responde este documento**

- Qué falta para saber, con datos, que Pulso detecta solo los cortes
- Con qué datos y con qué criterio se toma D-012 (qué mecanismos quedan)
- Qué se borra del código según lo que salga

| | |
| --- | --- |
| Se trabaja en | `pulso-app`, con el Xiaomi en la mano. Los exportes se analizan en `pulso-api` |
| Depende de | Nada para juntar datos. El borrado de mecanismos va después de la fase 6 |
| Puede ir a la vez que | Las fases 6 y 7, mientras solo se junten datos |
| No puede ir a la vez que | La fase 9 mientras se borran mecanismos: tocan el módulo nativo y `app.json` |
| Trabajo estimado | 4 a 6 horas, repartidas en una o dos semanas de datos (estimación, sin medir) |
| Viene de | Fase 0 (corte C2), tarea 2a.4 (D-012) y lo que quedó pendiente de la sesión con el Xiaomi del 3 y 4 de noviembre |

El estado de la fase está en el tablero, `docs/roadmap.md`.

## Siguiente paso

Isaac exporta el registro del Xiaomi antes del 18 de noviembre, deja el teléfono enchufado y quieto en casa, y dice si el router tiene UPS. Con eso la sesión analiza el exporte, pone la casa en el modo que corresponde y hace la prueba pendiente del modo base: desenchufar el teléfono y apagar el router 15 minutos, y ver el corte en staging.

## Lista cuando

- D-012 está en `docs/decisions.md`, con su tabla de datos en `docs/detection.md`.
- El código y el manifiesto no tienen los mecanismos descartados.
- Un corte se vio de punta a punta en staging en modo base y en modo UPS, sin reporte manual.

## Lo que necesita de Isaac

- [ ] **Exportar el registro del Xiaomi antes del 18 de noviembre** (Ajustes → Diagnóstico → Exportar → WhatsApp) y pasarlo. El teléfono guarda 14 días: el corte del 4 de noviembre, de 6:12 a 9:04 p. m., se borra el 18 por la tarde. Es el único corte que el servidor abrió y cerró solo.
- [ ] **Dejar el Xiaomi enchufado en casa**, sin moverlo, con «Inicio automático» activo, y decir si el router tiene UPS.
- [ ] **Sesión con el teléfono** para el corte simulado en modo base y las mediciones de «Verificar la detección».
- [ ] **C2 · La app en dos teléfonos más de la familia** (el Samsung, con sus ajustes de fábrica) y pedirles un exporte cada pocos días, por la misma razón de los 14 días.
- [ ] **Tocar «Sin luz» y «Hay luz»** cada vez que note un corte: es la verdad contra la que se mide.
- [ ] **Responder «Decisiones abiertas».**

## Tareas

### Verificar la detección

- [ ] Corte simulado en modo base, de punta a punta contra staging: desenchufar y apagar el router 15 minutos. El corte aparece en `GET /v1/homes/me/status` y Diagnóstico dice «pendientes: 0». Es la verificación de la fase 2a, que nunca se anotó.
- [ ] Un corte real en modo UPS con la regla de `locked` (D-044): de 10 minutos o más, que abra y cierre solo.
- [ ] Mediciones que `docs/detection.md` deja abiertas, en el Xiaomi y en el Samsung: B y C con el teléfono desenchufado, en Doze y en el bucket `rare`; batería en 24 horas con D encendido y con D apagado. Enchufado y bloqueado, B ya corrió una noche entera (sesión del 3 y 4 de noviembre).
- [ ] Revisar con los datos tres dudas que salieron de leer el código: una subida que arranca más de 60 s tarde vuelve a esperar al azar, sin tope (`UploadPolicy.startDecision` en `UploadWorker.kt`); el modo UPS en un teléfono sin bloqueo de pantalla, donde `locked` llega en `false`; y un cambio de router, que deja la huella vieja y la casa sin detección.

### Decidir D-012

- [ ] Pasar cada exporte por `pnpm spike:analyze <archivo.json>` en `pulso-api` y armar en `docs/detection.md` la tabla por corte y por mecanismo: si disparó, retraso del inicio y del fin, y bucket.
- [ ] Registrar D-012 en `docs/decisions.md` con el criterio de `docs/detection.md` (5 o más cortes reales en al menos 2 teléfonos). Si el día del envío de la fase 11 no hay esos datos, vale D-029: se quita solo lo que los datos descartan y D queda como opción apagada.
- [ ] Borrar del código y del manifiesto los mecanismos descartados, con sus tests, y quitar el interruptor de D si D sale. Ver «Qué se borra según el resultado».
- [ ] Si D se queda en el manifiesto, anotarlo en «Apuntes» de la fase 11: entonces hay que declarar el servicio `specialUse` y grabar el video.

### Contrato

- [ ] Un test en `pulso-api` que valide contra el esquema un evento real con `locked`. La revisión del 13 de noviembre no encontró ninguno: el test del modo UPS lee su fixture sin pasarlo por el esquema.

## Qué se borra según el resultado

Lista preparada el 13 de noviembre leyendo el código. Confirmar cada archivo al borrar.

| Resultado | Qué se hace |
| --- | --- |
| A o C bastan (queda A + B + C) | Se borra D: `PowerWatchService.kt` y su test, su `<service>` y los permisos `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_SPECIAL_USE` del manifiesto del módulo, el arranque y el interruptor de D en `Arming.kt`, `foreground-service.ts`, la sección «Detección» de Ajustes, el interruptor de Diagnóstico, la frase del servicio en `app/onboarding/notifications.tsx` y la declaración de `docs/play-store.md` |
| Solo B es fiable | D se queda como opción que enciende la persona y se borra C (`ChargingJobService.kt` y su test). Hace falta código nuevo para que el modo UPS encienda D |
| Menos de 70% sin servicio en Xiaomi | No se borra nada. D pasa a encenderse por defecto en Xiaomi, Redmi y Poco, el onboarding tiene que pedir antes el permiso de notificaciones, y la justificación de Play ya no puede decir «apagado por defecto» |
| Sin datos suficientes (D-029) | El código ya está así: A, B y C armados, y D opcional y apagado |

Al borrar cualquier mecanismo: el exporte exige las claves `armed.foregroundService` y `armed.chargingJob`, y `power_receiver` y `charging_job` se quedan en el enum de la API porque las versiones viejas los mandan. Después de borrar D, mirar en el manifiesto final si `FOREGROUND_SERVICE` sigue llegando por otra librería.

## Decisiones abiertas

| Decisión | Por qué importa | Si Isaac no decide |
| --- | --- | --- |
| ¿El reporte «Sin luz» deja poner una hora anterior? | Hoy toma la hora del toque: quien avisa tarde deja el corte más corto. Toca el contrato, Kotlin y la pantalla | No se agrega en la v1 |
| ¿Se borran de staging la casa vieja de prueba y el corte falso de 3 días y 20 horas? | Ensucian los datos con los que se va a decidir | Se quedan y la tabla de datos los excluye |
| ¿Arranque directo tras reiniciar? | Hoy, después de reiniciar, nada corre hasta el primer desbloqueo | No se hace en la v1 |

## Apuntes

- **Lo que se sabía el 13 de noviembre, por los datos de staging.** El único teléfono que reporta es el Redmi A5. De los cortes reales anotados, el del 3 de noviembre a la 1:25 p. m. lo abrió un reporte manual, y el de las 7:42 p. m. no se abrió porque MIUI encendió la pantalla (de ahí salió D-044). El único corte que el servidor abrió y cerró solo fue el del 4 de noviembre, de 6:12 a 9:04 p. m., en modo UPS. Isaac cree que fue real.
- **El Xiaomi estuvo sin cargador casi todo el tiempo desde el 4 de noviembre.** Del 4 al 8 quedó desenchufado y bloqueado, y el servidor lo registró como un corte de 3 días y 20 horas: es el costo que D-044 aceptó. Nada de lo que subió en esos días sirve como medición de cortes.
- **Desenchufado, el latido se atrasa.** Con el teléfono sin cargador la casa cayó a «sin noticias» más de una vez (la noche del 12 al 13 y la tarde del 13 de noviembre): pasaron más de 40 minutos sin latido. Es un dato para la medición de B en Doze.
- **Nunca se ha medido fuera del bucket activo.** El 13 de noviembre el diagnóstico del Xiaomi en staging decía bucket 5 (exento) y `ignoringBatteryOptimizations: true`.
- **El regreso de la madrugada del 4 de noviembre**, que se vio recién con el latido de las 2:16 a. m.: ese snapshot llegó con la batería en 97% y la pantalla encendida, así que la luz había vuelto poco antes y C no llegó horas tarde. Si C disparó o no ya no se puede saber. El teléfono se registró de nuevo ese día a la 1:30 p. m. y su primer snapshot llegó sin la huella de la red de casa: el almacén local se había vaciado. El servidor solo guarda el primer snapshot de cada cambio.
- **Los datos del servidor no sirven para comparar mecanismos**, porque solo sube el primer snapshot de cada cambio. La comparación sale de los exportes, que traen todos los snapshots con su fuente.
- El esquema del exporte en `pulso-api` (`src/domain/spike/schema.ts`) no conoce la clave `rejectedEvents` que el diagnóstico ya manda. No rompe, porque el esquema descarta lo que no conoce; sumarla al analizar exportes.
- Por leer el código, sin medirlo: en el modo base el corte solo abre si el servidor ve el Wi-Fi caído a 3 minutos o menos del desenchufe (`TRANSITION_MS`), y esa lectura es un trabajo a los 90 s sin hora garantizada. Mirarlo en la prueba del modo base.
- El lote real de la versión publicada (regla 5) se guarda en la fase 11, con el build que de verdad se sube a Play.

## Bitácora

- 13 nov 2026 · Fase creada al reorganizar el plan (D-046). No llegaron exportes de la familia y el 9 de noviembre pasó sin decidir D-012. Con la fecha de Play movida (D-045), la decisión se toma aquí, con datos.
