# Fase 6 · Arreglos antes del primer build

**Qué responde este documento**

- Qué hay que dejar listo en la app antes de construirla con EAS por primera vez
- Qué es obligatorio para ese build y qué es pulido que Isaac puede descartar
- Por dónde sigue la próxima sesión

| | |
| --- | --- |
| Se trabaja en | `pulso-app`, rama `app-v1` |
| Depende de | Nada |
| Puede ir a la vez que | La fase 7 (trabaja en `pulso-api`; de este repo solo toca el cliente generado, su archivo de fase y su fila del tablero) y la toma de datos de la fase 8 |
| No puede ir a la vez que | La fase 9 ni el borrado de mecanismos de la fase 8: tocan `app.json` y el módulo nativo |
| Trabajo estimado | 6 a 10 horas (estimación, sin medir) |
| Viene de | Lo que encontró la revisión del 13 de noviembre y los menores que las revisiones de fase dejaron para después |

El estado de la fase está en el tablero, `docs/roadmap.md`.

## Siguiente paso

Empezar por «Config nativa»: son los cambios que solo entran con un build nuevo. Antes de tocar el plugin del splash o el de notificaciones, leer su documentación de Expo SDK 58 (primera trampa de `AGENTS.md`).

## Lista cuando

- Lint, tipos, Jest y los tests de Kotlin pasan en el CI.
- Un APK release local (`pnpm android:release`) abre con el splash de Pulso sobre fondo oscuro, y su manifiesto final no trae `SYSTEM_ALERT_WINDOW`.
- Cada tarea de «Pulido» está hecha, o movida a «Apuntes» porque Isaac la descartó.

## Lo que necesita de Isaac

- [ ] **Responder «Decisiones abiertas».** No frena la fase: cada una tiene su salida si no hay respuesta.

## Tareas

### Config nativa (solo entra con un build)

- [ ] Splash con la marca sobre `#0B0F14`. Hoy sale la plantilla de Expo sobre blanco: el plugin `expo-splash-screen` de `app.json` no tiene opciones y `assets/splash-icon.png` no se usa.
- [ ] Ícono pequeño de notificación, blanco con transparencia, en el plugin `expo-notifications`, que hoy solo trae `color` y `defaultChannel`. Sale de `assets/brand/` con `pnpm brand:render`.
- [ ] Bloquear `SYSTEM_ALERT_WINDOW` con `android.blockedPermissions` y cubrirlo en `__tests__/app-config.test.ts`. El manifiesto del release del 4 de noviembre lo trae y la app no lo usa. Revisar de paso si quedan permisos de almacenamiento de la plantilla.
- [ ] Fijar en `eas.json` la versión de Node y de pnpm del proyecto (Node 24, pnpm 12.14) y `cli.version`, para que el primer build de EAS no falle por el entorno.
- [ ] Igualar la versión: `package.json` dice 0.1.0 y `app.json` 0.2.0.

### Red de seguridad

- [ ] El CI corre los tests de Kotlin (`:power-monitor:testDebugUnitTest`). Hoy solo corre lint, tipos y Jest, y los tests del token, la subida y el borrado dependen de que alguien los corra a mano.
- [ ] Una comprobación de que el cliente generado sigue al día con el contrato de la API. Hoy nada lo verifica.

### Capturas

- [ ] Script que enmarca las capturas en 1080 × 1920 sobre `#0B0F14`, sin canal alfa y con el texto de cada marco (tabla «Capturas de pantalla» de `docs/play-store.md`), con el método de `scripts/brand/`. Las cinco de `assets/store/screenshots-raw/` miden 720 × 1640 con alfa y Play las rechaza así.

### Pulido (lo que no entre puede ir en una actualización)

- [ ] «p. m.» se parte en dos líneas en Estado: `formatClock` usa espacios normales (`src/modules/home/format.ts`).
- [ ] En el onboarding y en las pantallas fuera de las pestañas el contenido pasa bajo los botones del sistema: solo se reserva el borde de arriba (`src/modules/onboarding/ui.tsx`, `src/modules/home/ui.tsx`).
- [ ] Familia no avisa cuando el refresco falla y muestra la lista anterior; Estado e Historial sí avisan (`src/modules/family/screens/FamilyScreen.tsx`).
- [ ] Después de un reporte manual, Estado no vuelve a pedir el estado de la casa: tras tocar «Sin luz» la tarjeta sigue en «Hay luz» hasta refrescar (`src/modules/home/screens/StatusScreen.tsx`).
- [ ] Quien negó el permiso de notificaciones no se entera de que no recibe avisos: solo `src/modules/notifications/push-token.ts` mira el permiso.
- [ ] Quien tocó «Lo hago después» en el Wi-Fi de casa solo puede aprender la red desde Diagnóstico, y el aviso de riesgo no lo mira (`src/modules/home/detection-risk.ts`). Pasa lo mismo al cambiar de router.
- [ ] Un enlace `/c/CODIGO` abierto durante el onboarding pierde el código: la ruta está protegida hasta terminarlo (costo anotado en D-041).
- [ ] Diagnóstico todavía se titula «Registrador» y repite botones que ya están en Estado y en Ajustes (`app/debug.tsx`).
- [ ] El enlace de borrado apunta siempre a producción, aunque la build sea de staging (`DELETE_DATA_URL` en `src/modules/home/delete-data.ts`).
- [ ] «Borrar mis datos» no limpia la clave de AsyncStorage que recuerda la versión reportada (`REPORTED_VERSION_KEY` en `src/modules/onboarding/app-version.ts`).
- [ ] Accesibilidad: el test de nombres accesibles (`src/modules/home/__tests__/accessibility.test.tsx`) no cubre Familia ni «Seguir una casa», y los tres botones de reporte achican la letra en vez de dejarla crecer.

### Documentos que quedaron viejos

- [ ] `docs/security-privacy.md` y `docs/play-store.md`: dicen que el código de la casa se regenera «en Ajustes» y el botón está en la pestaña Familia; tampoco nombran que se guarda si el teléfono está bloqueado (`locked`). Tienen que decir lo mismo que la política `/privacidad`, que corrige la fase 7.
- [ ] `docs/architecture.md`: las carpetas, la caché de Familia, el esquema nativo y EAS Update no coinciden con el código, y no lista lo que se guarda en AsyncStorage.
- [ ] `docs/product.md`: la tabla de alcance todavía pone como actualizaciones las barras del historial y el aviso de riesgo, que ya están hechos; además dice «el modo UPS llega en la primera actualización» y «la API sirve dos páginas». Lo de cuándo pasa la casa a «sin luz» es una decisión abierta de la fase 7.
- [ ] `docs/detection.md`: falta la señal `locked` en la tabla de señales, faltan permisos del manifiesto final en la tabla de permisos, y el criterio del modo UPS todavía dice «con la pantalla apagada» (desde D-044 cuenta `locked`).
- [ ] `docs/registrador.md`: describe el APK 0.1.0. Reescribirlo para la app que se le mande a la familia en la fase 8.

### Cierre

- [ ] APK release local y revisión del splash, del ícono y de los permisos (`aapt dump permissions`).
- [ ] Solo si Isaac dice que sí: unir `app-v1` a `main` (entra con fast-forward) y marcar la versión con un tag.

## Decisiones abiertas

| Decisión | Por qué importa | Si Isaac no decide |
| --- | --- | --- |
| ¿Unir `app-v1` a `main`? | El `main` público muestra el proyecto del 23 de octubre | Se queda en `app-v1` |
| ¿A dónde lleva tocar un aviso de corte? | Hoy solo abre la app, y el aviso ya trae la casa | Se queda así |
| ¿Un teléfono «Solo seguir» abre en Familia? | Hoy abre en Estado, que le dice que vaya a Familia (costo de D-040) | Se queda así |

## Apuntes

- EAS Update (`expo-updates`) pasó a la fase 9: configurarlo necesita el `projectId` de la cuenta de Expo, que se crea ahí.
- Las pantallas del onboarding tienen lógica dentro de `app/onboarding/`, contra la convención de que `app/` solo compone rutas. Menor, sin fecha.
- El canal `cortes` se crea al registrar el push token (`ensureChannel` en `push-token.ts`). Revisar contra la documentación de Expo si tiene que existir antes de pedir el permiso en Android 13 o superior.
- El comentario del manifiesto del módulo (`modules/power-monitor/android/src/main/AndroidManifest.xml`) dice que D es «solo en el registrador». Se corrige o se borra con D-012, en la fase 8.

## Bitácora

- 13 nov 2026 · Fase creada al reorganizar el plan (D-046). Nada empezado.
