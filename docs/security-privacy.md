# Seguridad y privacidad

**Qué responde este documento**

- Qué datos guarda Pulso, dónde y cuánto tiempo
- Qué se protege, cómo, y qué no
- Qué debe decir la política de privacidad y cómo se llena el formulario de Play

## Qué se guarda

| Dato | Dónde | Retención |
| --- | --- | --- |
| Identificador anónimo del dispositivo y hash del token | PostgreSQL | Hasta borrar los datos o 180 días sin actividad |
| Corriente, Wi-Fi, internet, "red de casa sí/no", pantalla y batería, con su hora | PostgreSQL (`events`) y teléfono | 30 días en el servidor, 14 en el teléfono |
| Reportes y confirmaciones | PostgreSQL (`events`) | 30 días |
| Cortes detectados | PostgreSQL (`outages`) | Mientras exista la casa |
| Alias de la casa y de las casas que sigo | PostgreSQL | Mientras existan |
| Fabricante, modelo, versión de Android y de la app, estado de ahorro de batería | PostgreSQL (`devices.diagnostics`) | Mientras exista el dispositivo |
| Token push | PostgreSQL | Mientras exista el dispositivo |
| Errores de la app y de la API | Sentry | Según el plan gratuito |

No se guardan nombre, teléfono, correo, ubicación, SSID, BSSID ni contactos. La huella de la red de casa se calcula y se queda en el teléfono.

## Modelo de amenazas

| Amenaza | Protección | Límite honesto |
| --- | --- | --- |
| Robo del token del teléfono | El token vive en la bóveda del módulo nativo (Android Keystore). El servidor guarda solo el SHA-256. El token se devuelve una sola vez. Nunca aparece en logs ni en Sentry | Un teléfono con root puede extraerlo |
| Enumerar códigos de casas para ver quién está sin luz | 8 caracteres de un alfabeto de 31 (≈ 8,5 × 10¹¹ combinaciones), límite por IP, regeneración desde ajustes | Quien ya tiene el código ve el estado hasta que se regenere |
| Lotes falsos para inventar cortes | Token por dispositivo y límite por dispositivo | Afecta el historial propio y las alertas de quien sigue esa casa |
| Registros masivos de dispositivos | 5 por minuto por IP (pulso-api A-014); se borran a los 7 días los que nunca mandaron nada | Con CGNAT el límite tiene que ser holgado; Play Integrity queda para v1.1 si hace falta |
| Secretos en el bundle | Nada secreto en `EXPO_PUBLIC_*` ni en git; los secretos del Worker con `wrangler secret put` y la cadena de conexión solo en Hyperdrive | |
| Lectura de la base por la API REST de Supabase | Tablas en el esquema `app` (no expuesto), RLS activado sin políticas, rol propio `pulso_api`; las claves `anon` y `service_role` no se usan | Si alguien obtuviera la contraseña de la base, leería todo: vive solo en Hyperdrive y en los secretos de GitHub, y se rota si hay sospecha |
| Datos personales en Sentry | `sendDefaultPii: false` y se filtran `Authorization` y `token` en `beforeSend` y en los breadcrumbs | |
| Exporte del registrador | Solo por acción del usuario desde la pantalla de registro; contiene solo eventos y diagnóstico | Quien recibe el archivo ve el historial de esa casa |

Antes del mapa colaborativo (v1.1) hay que revisar este modelo: ahí los datos falsos sí afectarían a otros usuarios.

## Borrar los datos

Ajustes → "Borrar mis datos" llama a `DELETE /v1/devices/me`. La página pública `/borrar-datos` explica cómo hacerlo y da un correo para pedirlo si ya no tienes la app. El servidor borra en cascada el dispositivo, su casa, eventos, cortes, seguidores y tickets de push. En el teléfono se borran el almacén de eventos, la bóveda y la huella, se cancelan los trabajos y la app vuelve al onboarding.

## Política de privacidad

Publicada en `GET /privacidad`, servida por la API. Se enlaza desde la ficha de Google Play y desde ajustes. Debe decir, en lenguaje simple:

- Qué se recoge (la tabla de arriba) y para qué
- Que no se recoge ubicación ni el nombre de la red
- Cuánto tiempo se guarda cada cosa
- Que se usan proveedores para operar (Cloudflare, Supabase, Expo y Firebase para el push, Sentry y GitHub para los respaldos cifrados) y que no se venden datos
- Cómo borrar todo desde la app
- Que el código de la casa permite a quien lo tenga ver si hay luz, y cómo regenerarlo
- Un contacto (correo del desarrollador)

## Formulario de seguridad de datos de Play

Tiene que coincidir con la política.

| Pregunta | Respuesta |
| --- | --- |
| ¿Recoge datos? | Sí: IDs del dispositivo (identificador anónimo y token push), actividad de la app (eventos de corriente y red), información y rendimiento (diagnóstico y fallos) |
| ¿Comparte datos con terceros? | No. El procesamiento por proveedores de servicio no cuenta como compartir |
| ¿Cifrado en tránsito? | Sí (HTTPS) |
| ¿El usuario puede pedir que se borren? | Sí, desde la app |
| ¿Ubicación? | No |
