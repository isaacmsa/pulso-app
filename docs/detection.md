# Detección de cortes

**Qué responde este documento**

- Qué lee el teléfono y qué mecanismos lo despiertan
- Cómo se decide qué mecanismo queda, con qué datos y con qué criterio
- Qué necesita saber la app del clasificador (que vive en el backend)
- Cómo funciona el modo router con UPS
- Qué permisos pide la v1 y qué límites tiene la detección

## Señales de un snapshot

Cada vez que algo despierta el módulo nativo, este lee el estado del teléfono y guarda un evento `snapshot`.

| Campo | De dónde sale | Permiso |
| --- | --- | --- |
| `plugged` | Broadcast fijo `ACTION_BATTERY_CHANGED` (receiver `null`), `EXTRA_PLUGGED ≠ 0`. Significa "conectado a la corriente", aunque la batería esté al 100% | Ninguno |
| `batteryPct` | `EXTRA_LEVEL / EXTRA_SCALE`; `null` si no viene | Ninguno |
| `onWifi` | Alguna red conectada con `TRANSPORT_WIFI`, no solo la activa: si el router no tiene internet, Android pasa la red por defecto a datos móviles pero el Wi-Fi sigue ahí | `ACCESS_NETWORK_STATE` |
| `internet` | Esa red Wi-Fi tiene `NET_CAPABILITY_VALIDATED`; `null` sin Wi-Fi | `ACCESS_NETWORK_STATE` |
| `homeWifi` | La huella de la red actual (SHA-256 de gateway IPv4 + subred, sacados de `LinkProperties`) coincide con la que se aprendió en el onboarding; `null` si todavía no hay huella | `ACCESS_NETWORK_STATE` |
| `interactive` | `PowerManager.isInteractive()`; `null` si no se pudo leer | Ninguno |

No se leen el SSID ni el BSSID, porque exigen permiso de ubicación. La huella nunca sale del teléfono. Es una heurística: otra red con el mismo gateway y la misma subred (muchas usan `192.168.1.1/24`) se confunde con la de casa. Por eso el clasificador solo la usa en dos reglas, marcadas en `pulso-api/docs/classifier.md`.

## Mecanismos que despiertan la app

| Id | Mecanismo | Qué capta | Duda que mide la prueba técnica |
| --- | --- | --- | --- |
| A | `registerNetworkCallback(request, PendingIntent)` para Wi-Fi y para internet (`PendingIntent` mutable, re-registrado al arrancar) | Que vuelve el Wi-Fi (fin del corte). Quizás el cambio a datos al caerse el Wi-Fi | La variante con `PendingIntent` está documentada para "una red quedó disponible": no está garantizado que despierte al **perder** el Wi-Fi |
| B | Latido con WorkManager cada 15 minutos | Todo, con hasta 15 minutos de retraso (más en Doze) | Frecuencia real en Xiaomi y con la app en el bucket `rare` |
| C | Trabajo de JobScheduler con `setRequiresCharging(true)`: al desenchufar, el sistema lo detiene con `STOP_REASON_CONSTRAINT_CHARGING` (API 31+) | La desconexión del cargador en segundos, sin servicio en primer plano | Si el sistema lo reprograma sin huecos y si los fabricantes lo respetan |
| D | Servicio en primer plano `specialUse` con un receiver dinámico de `ACTION_POWER_CONNECTED/DISCONNECTED` | La desconexión exacta, al segundo | Costo de batería en 24 h, notificación permanente, aprobación de Play para `specialUse` |
| — | Seguimiento de transición: al ver `plugged` pasar a `false`, el módulo programa otro snapshot a los 90 s | Si el Wi-Fi se cayó justo después del cargador (corte) o siguió (alguien desenchufó) | |
| — | App abierta, `BOOT_COMPLETED` y `MY_PACKAGE_REPLACED` | Re-arma A, B, C (y D si está activo) y toma un snapshot | |

Android 8+ no entrega `ACTION_POWER_DISCONNECTED` a receivers declarados en el manifiesto. Por eso C y D existen.

**Por qué Doze molesta menos de lo que parece:** justo antes del corte el teléfono estaba cargando, así que no está en Doze. Al volver la luz empieza a cargar y sale de Doze. Lo que sí pesa es el **App Standby**: una app que se instala y no se vuelve a abrir cae al bucket `rare` o `restricted`, y sus trabajos se retrasan horas. El diagnóstico registra el bucket en cada lote para verlo con datos.

## Prueba técnica

Durante las semanas 1 a 4, el build "registrador" corre los cuatro mecanismos a la vez y etiqueta cada snapshot con su `source`. Como los cortes son diarios, cada uno se convierte en un dato para decidir y, si sirve, en un fixture de test del backend.

**Teléfonos**

| Teléfono | Rol | Configuración |
| --- | --- | --- |
| Xiaomi de respaldo | Principal, siempre enchufado en casa | Con inicio automático y batería "Sin restricciones" (lo que hará un usuario guiado) |
| Samsung | Segundo hogar o la misma casa | De fábrica, sin tocar ajustes (lo que hará un usuario que no lee) |
| 2 o 3 teléfonos de la familia | Más cortes y más marcas | Como quieran |

**Verdad de referencia:** los botones "Se fue la luz ahora" y "Volvió" de la pantalla de registro, que guardan eventos `report`. Si D está activo, su hora sirve para afinar.

**Protocolo**

1. Simulado, en el escritorio: `adb shell dumpsys battery unplug` y apagar el router a mano. Restaurar con `adb shell dumpsys battery reset`.
2. Doze y standby forzados: `adb shell dumpsys deviceidle force-idle` y `adb shell am set-standby-bucket com.isaacmendoza.pulso rare`. Deshacer con `adb shell dumpsys deviceidle unforce` y `adb shell am set-standby-bucket com.isaacmendoza.pulso active`.
3. Real: cortes de la casa. Cada 3 o 4 días, "Exportar" en la pantalla de registro → WhatsApp → `pnpm spike:analyze <archivo.json>` en `pulso-api`.
4. Batería: % atribuido a Pulso en 24 h, con D apagado y con D encendido.

Con el cable USB conectado el teléfono está cargando y la prueba no sirve: usar depuración inalámbrica (`adb pair` y `adb connect`).

**Qué se mide por corte y por mecanismo:** retraso del inicio y del fin frente a la verdad, si disparó o no, y el estado de diagnóstico (bucket, optimización de batería).

**Criterio de decisión (D-012, el 9 de noviembre, con 5 o más cortes reales en al menos 2 teléfonos)**

| Resultado | Decisión |
| --- | --- |
| A o C captan 90% o más de los inicios con mediana de 2 minutos o menos, en ambos teléfonos | Modo base sin servicio en primer plano: A + B + C. D se elimina del manifiesto |
| Solo B es fiable | Se aceptan ±15 minutos en la hora de inicio; D queda como opción "detección precisa" que el usuario activa |
| Menos de 70% sin servicio en Xiaomi | D por defecto en ese fabricante, con su declaración en Play |
| Modo UPS | Necesita ver el desenchufe con la pantalla apagada: C si funciona, si no D |

La decisión se registra en `docs/decisions.md` con la tabla de datos, y los mecanismos descartados se borran del código en la misma PR.

## Clasificador

Las reglas que convierten los snapshots en cortes viven solo en el backend (D-016): `pulso-api/docs/classifier.md`, con sus constantes (`MIN_OUTAGE_MS` 10 min, `TRANSITION_MS` 3 min) y sus tests obligatorios. Lo que importa del lado de la app:

- El teléfono no clasifica. Sube snapshots con su hora original y el backend decide.
- El clasificador es invariante a snapshots repetidos, así que el teléfono puede subir solo los cambios de `(plugged, onWifi, homeWifi, internet)` (D-008).
- `homeWifi` es `null` solo si no hay huella aprendida; con huella y sin Wi-Fi es `false`.
- Los reportes ("se fue la luz", "volvió", "fluctuando") y las confirmaciones viajan como eventos en el mismo lote.

## Permisos de la v1

| Permiso | Para qué | Build |
| --- | --- | --- |
| `ACCESS_NETWORK_STATE` | Wi-Fi, internet y huella de la red | Todos |
| `POST_NOTIFICATIONS` | Push y confirmaciones (permiso en tiempo de ejecución desde Android 13) | Todos |
| `RECEIVE_BOOT_COMPLETED` | Re-armar los mecanismos al reiniciar; trabajo C persistente | Todos |
| `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_SPECIAL_USE` | Mecanismo D | Registrador; en producción solo si lo decide D-012 |

La v1 no pide ubicación de ningún tipo, ni `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`: la app abre la pantalla de ajustes de batería y guía al usuario.

## Límites conocidos

- **Sin datos móviles**, el inicio del corte se conoce cuando vuelve la luz. La familia ve "sin noticias" mientras tanto.
- **Teléfono que se apaga** durante un corte largo: el corte se cierra cuando alguien lo enciende enchufado, así que la duración queda inflada. La confirmación lo corrige.
- **Modo base**: si alguien desenchufa el teléfono, sale y lo vuelve a enchufar antes de que conecte el Wi-Fi, puede colarse un corte falso. La confirmación lo corrige.
- **Modo UPS**: un cable flojo o un cargador defectuoso con la pantalla apagada abren un corte falso. Por eso siempre se pide confirmación.
- **Huella de la red**: otra red con el mismo gateway y la misma subred pasa por la de casa.
- **Algunos fabricantes encienden la pantalla al desenchufar**: eso rompería la regla de `interactive` del modo UPS. El registrador lo mide.
