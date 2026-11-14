# Fase 9 · Primer build con EAS y push

**Qué responde este documento**

- Qué cuentas hacen falta para construir la app con EAS y recibir push
- Cómo se prueba el push entre dos teléfonos antes de dárselo a los testers
- Qué capturas quedan listas para Play

| | |
| --- | --- |
| Se trabaja en | `pulso-app`, con el Xiaomi y un segundo Android. La huella del keystore toca además `pulso-api/wrangler.jsonc` |
| Depende de | La fase 6: lo nativo va dentro del build |
| Puede ir a la vez que | La fase 7 y la toma de datos de la fase 8 |
| No puede ir a la vez que | La fase 6 ni el borrado de mecanismos de la fase 8: tocan `app.json` y el módulo nativo |
| Trabajo estimado | 5 a 7 horas (estimación, sin medir) |
| Viene de | Tarea 2b.2, fase 3 (cortes C4 y C5), las verificaciones de las fases 3 y 4 y Sentry de la app (C6) |

El estado de la fase está en el tablero, `docs/roadmap.md`.

## Siguiente paso

Isaac crea la cuenta de Expo y hace `eas login`. La sesión corre `eas init`, que escribe el `projectId` en `app.json`, y lanza el build `preview`.

## Lista cuando

- Un corte simulado en el Xiaomi llega al segundo Android como un solo aviso de inicio y uno de regreso, y la respuesta Sí o No queda guardada.
- 45 minutos sin red dejan la casa en «sin noticias», y al volver se ve el estado correcto.
- Las capturas de Play están completas y enmarcadas.

## Lo que necesita de Isaac

Nada cuesta dinero.

- [ ] **C4 · Cuenta de Expo** y `eas login` en esta Mac. `eas` no está instalado:

  ```bash
  npm install -g eas-cli
  ```

- [ ] **C5 · Proyecto de Firebase:** bajar `google-services.json` y subir la clave FCM V1 a EAS.
- [ ] **Un segundo Android** que siga la casa: uno de la familia o el emulador de Android Studio con Google Play.
- [ ] **Sesión con los dos teléfonos** para las pruebas de push y las capturas.
- [ ] **C6 · Cuenta de Sentry** para la app. Tiene que estar antes del AAB de la fase 11: el DSN solo entra con un build, y sin él los errores de los testers solo se saben si los cuentan.
- [ ] **Responder «Decisiones abiertas».**

## Tareas

### Cuentas y configuración

- [ ] `eas init`: deja `extra.eas.projectId` y `owner` en `app.json`. Sin `projectId` la app no pide push token (`src/modules/notifications/push-token.ts`).
- [ ] `google-services.json` y `android.googleServicesFile` en `app.json`, según lo que Isaac decida abajo.
- [ ] Solo si Isaac dice que sí: instalar y configurar `expo-updates` (EAS Update) antes del primer build, siguiendo la documentación de EAS Update de SDK 58. Si dice que no, quitar la promesa de `docs/architecture.md`.
- [ ] Solo si Isaac activa la seguridad reforzada de push en EAS (B5): cargar `EXPO_ACCESS_TOKEN` en staging y en producción del backend.

### Primer build

- [ ] `eas build -p android --profile preview` e instalarlo en el Xiaomi: Diagnóstico muestra «API: en línea». Reservar tiempo, porque es el primer build fuera de esta Mac y lleva un módulo Kotlin propio.
- [ ] Reactivar «Inicio automático» y confirmar en staging que el dispositivo ya tiene push token y que su `app_version` es la del build: el arreglo `617fea2` (reportar la versión al actualizar) nunca se probó en un teléfono.
- [ ] Con el manifiesto final: no aparece `com.google.android.gms.permission.AD_ID` (`aapt dump permissions`).
- [ ] Huella SHA-256 del keystore de EAS (se ve con `eas credentials`; confirmarlo en la documentación de EAS) en `vars.ANDROID_CERT_SHA256` de staging, en `pulso-api/wrangler.jsonc`, y `pnpm cf-typegen` en `pulso-api` (si no, su `ci` falla). El build `preview` va firmado con ese keystore, no con el de Play: sin la huella, el enlace `/c/CODIGO` no abre la app directo. Ese archivo también lo edita la fase 7: hacerlo con la 7 cerrada o avisar en su bitácora.

### Push de punta a punta

- [ ] El segundo Android sigue la casa con el código. Un corte simulado en el Xiaomi le llega como exactamente un «Se fue la luz» y un «Volvió la luz», aunque el cron corra dos veces.
- [ ] La confirmación Sí/No llega al teléfono de la casa y la respuesta queda como evento `confirmation`.
- [ ] El enlace compartido abre `/c/CODIGO` con «Se fue la luz a las…», el botón «Abrir en Pulso» abre la app y, con la huella puesta, el enlace abre la app directo.
- [ ] 45 minutos con el Wi-Fi y los datos del Xiaomi apagados: el segundo Android ve «Sin noticias de la casa desde las…», y al volver la red ve el estado correcto.
- [ ] Lo que las fases 3 y 4 dejaron para probar en el teléfono: la espera al azar tras volver la red, una sola subida en cola, el aviso de riesgo que lleva a la guía de batería y que no parpadea, el ícono de la notificación, letra grande y TalkBack, y el gesto de retroceso predictivo.

### Capturas

- [ ] Tomar la 02 (Estado durante un corte) y la 08 (el push en la cortina), y repetir la 01, la 06 y la 07: la hora sale partida en dos líneas, los botones del sistema tapan texto y el interruptor de D aparece encendido. Barra de estado limpia.
- [ ] La 04 (los tres botones de reporte) ya se ve en la 01: tomarla aparte o quitarla de la tabla de `docs/play-store.md`.
- [ ] Enmarcarlas todas con el script de la fase 6 y dejarlas en `assets/store/`.

### Si Isaac crea la cuenta de Sentry

- [ ] Los pasos de la trampa «Sentry está apagado hasta el corte C6» de `AGENTS.md`. Revisar además si los source maps piden un `metro.config.js` con la configuración de Sentry: el repo no tiene ese archivo.

## Decisiones abiertas

| Decisión | Por qué importa | Si Isaac no decide |
| --- | --- | --- |
| ¿EAS Update dentro del primer build? | Sin él, cada arreglo de JS durante la prueba cerrada es un build nuevo y otra revisión de Play. Con él hay una dependencia nativa más | No se instala |
| ¿`google-services.json` se versiona o va como archivo secreto de EAS? | El repo es público. Versionarlo es lo más simple; como archivo de EAS obliga a pasar `app.json` a `app.config.js` | Se versiona, después de confirmar en la documentación de Firebase que no es un secreto |
| ¿Seguridad reforzada de push en EAS (B5)? | Sin ella, quien tenga un push token puede mandarle avisos a ese teléfono | No se activa |

## Apuntes

- Nunca se ha mandado un push de verdad: el 13 de noviembre ningún dispositivo de staging tenía push token y no se había pedido ninguna confirmación.
- El aviso de riesgo por bucket `rare` casi nunca se va a ver con la app abierta: abrirla la devuelve a `active`. El bucket sí viaja al servidor en cada lote.
- El AAB de producción se construye en la fase 11, con el código ya cerrado por las fases 8 y 10.
- La captura 07 (Ajustes) muestra la sección «Detección» con el interruptor de D. Si D-012 quita D en la fase 8, esa sección desaparece: tomar la 07 después de esa decisión, o repetirla.

## Bitácora

- 13 nov 2026 · Fase creada al reorganizar el plan (D-046). No hay rastro de la cuenta de Expo ni de Firebase: `app.json` no tiene `projectId` y no existe `google-services.json`.
