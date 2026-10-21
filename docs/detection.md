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
| A | `registerNetworkCallback(request, PendingIntent)` para Wi-Fi, armado **solo cuando no hay Wi-Fi** (`PendingIntent` mutable con acción propia) | Que vuelve el Wi-Fi: el fin del corte | **Medido:** dispara una sola vez, cuando la red queda disponible, y el sistema libera el pedido unos 5 s después. Nunca avisa al perder el Wi-Fi |
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

## Hallazgos de la prueba técnica

Redmi A5 (Xiaomi 25028RN03L, Android 15, SDK 35), 20 de octubre de 2026:

| Hallazgo | Consecuencia |
| --- | --- |
| El `PendingIntent` de `registerNetworkCallback` dispara una vez, al quedar disponible una red que cumple el pedido, y se libera unos 5 s después. Si se arma con la red ya conectada, dispara al instante | A solo detecta la **vuelta** del Wi-Fi y se arma desde cada snapshot sin Wi-Fi. El inicio del corte depende de B, C y D |
| ConnectivityService compara los `PendingIntent` con `Intent.filterEquals`, que ignora el `requestCode` | Dos pedidos con el mismo Intent se pisan: cada uno necesita su propia acción |
| El latido de WorkManager corrió exactamente cada 15 min con la app en el bucket `active` | B es puntual en primer plano; falta medirlo en `rare` y con pantalla apagada |
| Tras reiniciar, `BOOT_COMPLETED` y los datos de la app solo están disponibles **después del primer desbloqueo** | Un teléfono que se apaga en un corte y vuelve a encender solo no registra nada hasta que alguien lo desbloquee. Evaluar *direct boot* (`LOCKED_BOOT_COMPLETED` y almacenamiento protegido del dispositivo) |
| MIUI apaga el "Inicio automático" **cada vez que se reinstala la app por adb**. Sin él no llega `BOOT_COMPLETED` y WorkManager no reagenda el latido hasta abrir la app | Después de cada `installDebug` hay que volver a activarlo. En Play no debería pasar al actualizar, pero hay que verificarlo en la prueba interna |
| Con cargador de pared, **C vio el desenchufe y el enchufe 15 a 17 ms después de D** (14:32:13.156 frente a .171; 14:34:08.753 frente a .770), con la app en `active` e Inicio automático | C rinde como D sin servicio ni notificación. Falta repetirlo con pantalla apagada, en Doze, en el bucket `rare` y en el Samsung antes de D-012 |
| C se detiene y debe volver a arrancar en cada corte. Con `onStopJob` devolviendo `true`, Android usaba su backoff exponencial (30 s que se duplican): tras 5 o 6 desenchufes, C esperó **16 min** para arrancar con el teléfono ya enchufado | C nunca pide reintento: al detenerse agenda un trabajo nuevo con el otro id, sin fallos acumulados. Verificado: tras 5 ciclos seguidos, C corre al instante |
| Un trabajo de JobScheduler corre como máximo ~10 min, y `jobFinished` es asíncrono | C alterna dos ids y agenda el relevo antes de terminar. Verificado con 26 min enchufado: relevo a los ~9 min sin quedar en cero |
| En ambas lecturas `interactive` vino en `true` | No se sabe si fue por tener el teléfono en la mano o porque MIUI enciende la pantalla al desenchufar. Si es lo segundo, rompe la regla del modo UPS: medirlo con el teléfono boca abajo y sin tocarlo |
| `adb shell dumpsys battery set …` no le llega al planificador de trabajos: después de simular, JobScheduler siguió creyendo que cargaba durante minutos | C solo se prueba con un cargador real. No simular la batería antes de una medición de C |
| El permiso de notificaciones quedó denegado hasta aceptarlo en el diálogo del sistema; sin él, D no arranca | El onboarding tiene que pedirlo y comprobar el resultado antes de activar D |
| Con la batería de Pulso en "Sin restricciones" de MIUI, Android sigue diciendo `isIgnoringBatteryOptimizations: false` | El ajuste de MIUI no es la exención de Doze de Android. El diagnóstico no puede usar ese campo para saber si el usuario siguió la guía; en Xiaomi hay que medir los efectos (latido, bucket) |
| El exporte del teléfono pasó por `pnpm spike:analyze` de `pulso-api` con 63 eventos válidos y 0 inválidos | El contrato Kotlin → API funciona de punta a punta |
| El puerto USB de la Mac no carga el Xiaomi (`USB powered: false`) | Las pruebas por cable no se contaminan con "cargando"; `plugged: true` se simula con `adb shell dumpsys battery set ac 1` |

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
