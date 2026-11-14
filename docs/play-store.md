# Publicación en Google Play

**Qué responde este documento**

- Qué exige Google a una cuenta personal nueva
- En qué orden se hace cada paso (el calendario está en `docs/roadmap.md`)
- Cómo se recluta y se cuida a los testers
- Qué se pega en la ficha y en cada formulario de Play Console

Los requisitos se verificaron el 15 de octubre de 2026. Revisarlos de nuevo el día que se cree la cuenta.

## Calendario

No hay fechas fijas (D-045): todo cuenta desde el día en que se pague Play Console. El calendario está en «Calendario» de `docs/roadmap.md`, y quién hace cada paso, en las fases 11 a 13 de `docs/phases/`.

## Pasos

Esta lista explica cada requisito. El avance no se marca aquí, sino en las fases 11 a 13.

- **Cuenta personal** de Play Console: pago único de USD 25 con una tarjeta que funcione en el exterior y esté a tu nombre legal. Luego verificación de identidad con documento y teléfono, y verificación desde un dispositivo Android con la app de Play Console (sirve el Xiaomi) ([Google](https://support.google.com/googleplay/android-developer/answer/6112435?hl=es)). Registrarse sin VPN y sin otro país: si el perfil de pagos no coincide con la identidad, se puede perder la cuenta. Plan B si el pago falla desde Venezuela: publicar con la cuenta de una organización (por ejemplo, Yagos Store) e invitarte como miembro. Las cuentas de organización no tienen el requisito de los 12 testers.
- **Nombre del paquete** `com.isaacmendoza.pulso` (D-010). Es permanente desde la primera subida.
- **Nivel de API**: las apps nuevas deben apuntar a Android 16, API 36, desde el 31 de agosto de 2026 ([Google](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-419)). Probar también el gesto de retroceso predictivo.
- **Play App Signing** activo. EAS genera el keystore de subida.
- **Política de privacidad** publicada en `https://pulso-api.isaac-mendozasa.workers.dev/privacidad`, y la página de borrado en `/borrar-datos` (ver `docs/security-privacy.md`).
- **Formularios** (respuestas en "Ficha y formularios"): seguridad de datos, clasificación de contenido, público objetivo (adultos), acceso a la app (no requiere inicio de sesión), anuncios (no) y declaración de permisos. Si D-012 deja el servicio `specialUse`, se declara con una descripción y un video corto que muestre la notificación y para qué sirve.
- **Ficha** en español: nombre ("Pulso: cortes de luz" si "Pulso" está tomado), descripción corta, descripción larga que explique la detección automática en una frase, ícono de 512 px, gráfico destacado de 1024 × 500 y capturas reales del Xiaomi.
- **Prueba interna** para ti y la familia (hasta 100 personas, sin revisión) desde que exista el primer AAB.
- **Prueba cerrada**: al menos 12 testers inscritos durante 14 días seguidos ([Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)).
- **Solicitud de acceso a producción**, respondiendo el cuestionario con datos concretos de la prueba: cuántos testers, qué reportaron y qué se cambió en cada actualización.
- **Lanzamiento escalonado**.

## Ficha y formularios (borrador listo para pegar)

Textos para la versión de la prueba cerrada, en español de Latinoamérica (`es-419`), que es el idioma predeterminado de la ficha. Describen todo lo que trae esa versión, que sale con todo lo construido (D-043): detección, estado, historial, reportes, push, confirmación, familia y modo UPS. Los conteos cuentan caracteres Unicode con los saltos de línea (`[...texto].length` en Node), y `__tests__/play-listing.test.ts` falla si un texto pasa el límite de Play.

### Nombre

```text
Pulso
```

5 caracteres (límite: 30). Si Play dice que "Pulso" está tomado, el respaldo es este, de 20 caracteres:

```text
Pulso: cortes de luz
```

### Descripción corta

```text
Anota sola cuándo se va y vuelve la luz en tu casa, y suma las horas sin luz.
```

77 caracteres (límite: 80).

### Descripción larga

```text
Pulso detecta solo cuándo se va y cuándo vuelve la luz en tu casa: dejas un Android enchufado en casa y, cuando se va la luz, el teléfono deja de cargar, el Wi-Fi se cae y Pulso anota la hora exacta, sin que tengas que abrir la app.

QUÉ HACE
• Te dice cómo está la casa: "Hay luz desde las 2:30 p. m." o "Se fue la luz a las 6:05 p. m. (1 h 20 min)".
• Lleva el historial de la semana: cuántas horas estuvo la casa sin luz cada día y el total.
• Muestra aparte lo que ve el propio teléfono, por ejemplo "Sin corriente desde las 6:05 p. m.", aunque no haya internet.
• Si notas algo, avisas con un toque: hay luz, fluctuando o sin luz. Esos reportes ayudan a afinar la detección.
• En Ajustes hay un diagnóstico de la detección (batería, fabricante y registro de eventos) para cuando algo falla.

AVISOS A LA FAMILIA
• Comparte el código de tu casa por WhatsApp. Quien lo tenga recibe un aviso cuando se va la luz y cuando vuelve.
• Quien no tenga Pulso puede ver si hay luz desde el enlace que le mandaste, en el navegador.
• Si te arrepientes, generas un código nuevo en Ajustes y el viejo deja de servir.
• Pulso te pregunta "¿Se fue la luz de 6:05 a 8:10?" para confirmar cada corte.
• Modo para routers con UPS (experimental): lo activas si tu router sigue con Wi-Fi durante el corte.

CÓMO FUNCIONA
Cuando se va la luz, el teléfono deja de cargar y el router se apaga. Pulso ve las dos cosas y las guarda con su hora. Si el teléfono tiene datos móviles, el corte se registra mientras pasa. Si no, Pulso sube lo que guardó cuando vuelven la luz y el internet, y el historial queda con la hora real del corte.

LO QUE NECESITAS
• Un teléfono Android que se quede en casa, enchufado y conectado al Wi-Fi.
• Algunos teléfonos (Xiaomi, Samsung y otros) cierran las apps que nadie abre. La primera vez, Pulso te guía paso a paso para que eso no pase.
• Si tu router está conectado a un UPS, el Wi-Fi no se cae durante el corte: activa el modo UPS en Ajustes.

TU PRIVACIDAD
• No pide tu ubicación ni lee el nombre de tu Wi-Fi. Reconoce la red de tu casa con una huella que se calcula y se queda en el teléfono.
• No hay cuentas ni contraseñas: el teléfono recibe un identificador anónimo.
• No guarda tu nombre, tu número de teléfono, tu correo ni tus contactos.
• Puedes borrar todos tus datos desde Ajustes cuando quieras.

LO QUE NO HACE
Pulso mide lo que pasa en tu casa. No adivina cuándo se va a ir la luz ni muestra cortes de otras zonas.

Pulso es gratis y no tiene anuncios.
```

2483 caracteres (límite: 4000). La primera frase explica la detección automática, como pide la ficha.

### Categoría y contacto

| Campo | Valor |
| --- | --- |
| Tipo | App |
| Categoría | Herramientas |
| Etiquetas | Las que Play ofrezca más cerca de "utilidades" o "hogar"; son opcionales |
| Correo de contacto | isaac.mendozasa@gmail.com |
| Sitio web | Vacío (es opcional) |
| Teléfono | Vacío (es opcional y quedaría público) |
| Gratis o de pago | Gratis. No se puede cambiar a pago después |
| Países de la prueba cerrada | Venezuela, más el país de cada tester que viva fuera (si su país no está en la lista, no puede instalarla) |

### Política de privacidad y borrado

| Campo | URL |
| --- | --- |
| Política de privacidad (Contenido de la app y ficha) | `https://pulso-api.isaac-mendozasa.workers.dev/privacidad` |
| Borrar los datos (sección de seguridad de datos) | `https://pulso-api.isaac-mendozasa.workers.dev/borrar-datos` |

Antes de pegarlas, abrirlas desde el teléfono sin sesión: tienen que cargar sin errores y nombrar a Pulso, porque Play las revisa.

### Seguridad de datos

Sale de la tabla "Formulario de seguridad de datos de Play" de `docs/security-privacy.md`, que manda. Aquí va desglosada en los tipos de datos que pide Play. Se declara desde ya todo lo de la v1: el token push está desde la prueba cerrada (D-043) y Sentry llega con su cuenta (corte C6, fase 9). Declarar de más no se castiga, y así el formulario no cambia durante la prueba.

| Pregunta | Respuesta |
| --- | --- |
| ¿La app recoge o comparte alguno de los tipos de datos requeridos? | Sí |
| ¿Todos los datos se cifran en tránsito? | Sí (HTTPS) |
| ¿Qué formas de pedir el borrado ofreces? | Desde la app (Ajustes → "Borrar mis datos") y con la URL de `/borrar-datos` |
| ¿La app permite crear cuentas? | No. Pulso no tiene cuentas: el borrado es del dispositivo y su casa |
| ¿Revisión de seguridad independiente? | No |

| Tipo de dato en Play | Qué es en Pulso | ¿Se recoge? | ¿Se comparte? | ¿Efímero? | ¿Obligatorio? | Para qué |
| --- | --- | --- | --- | --- | --- | --- |
| IDs del dispositivo u otros IDs | Identificador anónimo del dispositivo y token push (desde la prueba cerrada) | Sí | No | No | Sí | Funcionalidad de la app; prevención de fraudes y seguridad (límites por dispositivo) |
| Actividad en la app → Otras acciones | Eventos de corriente, Wi-Fi, internet, "red de casa sí/no", pantalla y batería, con su hora; reportes manuales ("Hay luz", "Fluctuando", "Sin luz") y confirmaciones | Sí | No | No | Sí | Funcionalidad de la app |
| Actividad en la app → Otro contenido generado por el usuario | Alias de la casa | Sí | No | No | No: la persona decide si lo cambia | Funcionalidad de la app |
| Información y rendimiento de la app → Registros de fallos | Errores de la app en Sentry (entra con la cuenta de Sentry, corte C6) | Sí | No | No | Sí | Estadísticas; funcionalidad de la app |
| Información y rendimiento de la app → Diagnóstico | Fabricante, modelo, versión de Android y de la app, ahorro de batería | Sí | No | No | Sí | Estadísticas; funcionalidad de la app |
| Ubicación, información personal, financiera, de salud, mensajes, fotos, audio, archivos, calendario, contactos, apps instaladas, historial web | Nada | No | | | | |

"Compartir" es No en todos: Cloudflare, Supabase, Expo, Firebase, Sentry y GitHub son proveedores que procesan los datos para que Pulso funcione, y Play no lo cuenta como compartir.

Solo el alias de la casa es "otro contenido generado por el usuario", porque es texto libre. Los reportes y las confirmaciones son toques en botones con un valor fijo: van con las otras acciones. La tabla de `docs/security-privacy.md` dice lo mismo.

Al pedir el acceso a producción hay que reconciliar este formulario con lo que trae esa versión: si el push o Sentry no entraron en la v1, se quitan el token push y los registros de fallos (D-034).

### Clasificación de contenido

Cuestionario de IARC:

| Pregunta | Respuesta |
| --- | --- |
| Correo para la clasificación | isaac.mendozasa@gmail.com |
| Categoría | "Todos los demás tipos de apps" (utilidades, productividad, comunicación y otras) |
| Violencia, miedo, sexualidad, lenguaje ofensivo, drogas, alcohol o tabaco | No |
| Apuestas, simuladas o reales | No |
| ¿Los usuarios interactúan o intercambian contenido entre ellos? | Quien tiene el código de una casa ve su alias (familia, D-043): revisar la respuesta al llenar el cuestionario |
| ¿Comparte la ubicación del usuario con otros? | No |
| ¿Permite compras digitales? | No |
| ¿Navegador web o buscador sin restricciones? | No |
| Resultado esperado | Apta para todo público (PEGI 3, ESRB "Everyone" o su equivalente en cada país) |

### Público objetivo y contenido

| Formulario | Respuesta |
| --- | --- |
| Público objetivo | Solo 18 años o más |
| ¿Puede atraer a niños sin querer? | No |
| Acceso a la app | "Todas las funciones están disponibles sin acceso especial". No hay inicio de sesión; para revisar sin un Wi-Fi de casa basta tocar "Lo hago después" en el último paso del onboarding |
| Anuncios | No, la app no tiene anuncios |
| ID de publicidad | No se usa. Con Firebase en la prueba cerrada, revisar el manifiesto final con `aapt dump permissions` para confirmar que no aparece `com.google.android.gms.permission.AD_ID` |
| App gubernamental | No |
| Funciones financieras | Ninguna |
| App de salud | No |
| App de noticias | No |

### Declaración de permisos (solo si D sigue en el manifiesto)

Depende de D-012 (fase 8). Si el mecanismo D sale del manifiesto, esta sección no se usa y se borran `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_SPECIAL_USE`. Si queda, según D-029 va apagado por defecto y se enciende en Ajustes → Detección → "Servicio en primer plano", y Play pide declarar el tipo `specialUse` con una descripción y un video.

**Tipo de servicio:** uso especial (`specialUse`). El subtipo del manifiesto, que tiene que coincidir con lo que se declara, es "Detecta cuándo se va y vuelve la luz en casa escuchando la conexión del cargador".

**Justificación (en español):**

```text
Pulso detecta los cortes de luz de una casa con un teléfono que queda enchufado allí. Cuando se va la luz, el teléfono deja de cargar. El servicio en primer plano registra un receptor de ACTION_POWER_CONNECTED y ACTION_POWER_DISCONNECTED, que Android 8 y posteriores ya no entregan a los receptores del manifiesto, para anotar la hora exacta en que se fue y volvió la corriente.

Ningún otro tipo de servicio describe esta tarea: no es reproducción de medios, ubicación, llamadas, sincronización de datos ni salud. JobScheduler y WorkManager pueden retrasar horas el aviso cuando el sistema duerme la app, y entonces el historial queda con una hora falsa.

El servicio es opcional y está apagado por defecto. La persona lo enciende en Ajustes, ve siempre la notificación "Pulso está vigilando la luz" y lo apaga con el mismo interruptor. No usa ubicación ni red mientras espera, y solo despierta al conectar o desconectar el cargador.
```

**Justificación (en inglés, por si el revisor la prefiere):**

```text
Pulso detects power outages in a home using a phone that stays plugged in there. When the power goes out, the phone stops charging. The foreground service registers a receiver for ACTION_POWER_CONNECTED and ACTION_POWER_DISCONNECTED, which Android 8+ no longer delivers to manifest receivers, to record the exact time the power went out and came back.

No other foreground service type describes this task: it is not media playback, location, phone calls, data sync or health. JobScheduler and WorkManager can delay the signal by hours when the system puts the app to sleep, which would store a wrong outage time.

The service is optional and off by default. The user turns it on in Settings, always sees the "Pulso está vigilando la luz" notification, and turns it off with the same switch. It uses no location and no network while waiting, and only wakes up when the charger is connected or disconnected.
```

**Impacto si se interrumpe o se retrasa:** el corte queda registrado tarde o no queda, y el historial de horas sin luz miente. Por eso no se puede diferir.

**Guion del video (borrador, solo si D sigue en el manifiesto).** Entre 30 y 60 segundos, en el Xiaomi, en modo oscuro. Se graba la pantalla con `adb shell screenrecord /sdcard/pulso-fgs.mp4` por depuración inalámbrica (con el cable USB el teléfono carga y la prueba no vale) y, en paralelo, el cargador con otra cámara; las dos tomas se juntan en un solo video. Se sube a YouTube como "no listado" y el enlace va en la declaración.

| Segundos | Qué se ve | Texto en pantalla |
| --- | --- | --- |
| 0 a 5 | Pulso abierto en Estado, con el teléfono enchufado: "Este teléfono: Con corriente desde las…" | "Pulso detecta los cortes de luz con el cargador" |
| 5 a 15 | Ajustes → Detección → se enciende "Servicio en primer plano". Si Android pide el permiso de notificaciones, se acepta | "El servicio es opcional y está apagado por defecto" |
| 15 a 22 | Se baja la cortina: la notificación fija "Pulso está vigilando la luz" | "Mientras está encendido, la notificación siempre se ve" |
| 22 a 35 | Toma del cargador: se desenchufa. Vuelta a la app: "Sin corriente desde las…" con la hora de ese momento | "Al desenchufar, Pulso anota la hora exacta" |
| 35 a 45 | Se enchufa de nuevo: "Con corriente desde las…" | "Y la hora en que volvió" |
| 45 a 55 | Ajustes → se apaga el interruptor; la notificación desaparece | "Se apaga con el mismo interruptor" |

### Capturas de pantalla (corte C3)

Se toman en el Xiaomi, en modo oscuro, con datos reales de la casa (nada inventado), con `adb exec-out screencap -p > 01-estado.png` por depuración inalámbrica. Antes de subirlas:

- **Proporción:** Play rechaza capturas cuyo lado largo pase del doble del corto. Una pantalla de 1080 × 2400 (20:9) no entra tal cual. Se enmarcan en 1080 × 1920 (9:16) sobre el fondo `#0B0F14`, con el texto de la tabla arriba y la captura reducida abajo, con el mismo método de `scripts/brand/` (HTML y Chrome sin ventana).
- **Formato:** `screencap` guarda PNG con canal alfa, y Play pide PNG de 24 bits o JPEG. El render con Chrome ya lo deja sin alfa.
- **Barra de estado:** con hora y batería normales; que no salgan el ícono de depuración ni otras notificaciones.

| Orden | Pantalla | Cómo dejarla lista | Texto del marco |
| --- | --- | --- | --- |
| 1 | Estado, con luz: "Hay luz desde las…" | Teléfono enchufado y en el Wi-Fi de casa, con el latido al día | "Sabe si hay luz en tu casa" |
| 2 | Estado, en un corte: "Se fue la luz a las… (… h … min)" | Durante un corte real de más de 10 minutos, con datos móviles; o un corte simulado (desenchufar y apagar el router) si no hay uno a mano | "Pulso nota solo cuándo se fue la luz" |
| 3 | Historial, con la semana y el total | Tras una semana con algún corte, para que no salga vacío | "Cuántas horas sin luz esta semana" |
| 4 | Estado, sección "¿Cómo está la luz ahora?" con los tres botones | Hacer scroll hasta los botones | "Avisa con un toque: hay luz, fluctuando o sin luz" |
| 5 | Onboarding: "¿Este teléfono se queda en casa?" | Instalación limpia o datos de la app borrados | "Se configura una vez y trabaja sola" |
| 6 | Onboarding: "Que el teléfono no cierre Pulso" | Mismo recorrido, paso de batería | "Te guía para que el teléfono no la cierre" |
| 7 | Ajustes, con "Borrar mis datos" y "Política de privacidad" | Nada especial | "Sin ubicación ni cuentas. Borra tus datos cuando quieras" |

Se suma una octava, con el push de "Se fue la luz" en la cortina: "Avisa a la familia cuando se va y cuando vuelve".

### Notas de la versión de la primera prueba cerrada

```text
<es-419>
Primera versión de prueba de Pulso.
• Detecta sola cuándo se va y vuelve la luz en tu casa, con el teléfono enchufado.
• Muestra cómo está la casa y las horas sin luz de la semana.
• Avisa con un toque, confirma cada corte con Sí o No y manda avisos a la familia que sigue tu casa.
• Modo UPS (experimental) y "Borrar mis datos" en Ajustes.
Déjala instalada y enchufada en casa, y cuéntanos en el grupo si notó cada corte.
</es-419>
```
422 caracteres entre las etiquetas (límite: 500).

## Testers

- **Reclutar 20, no 12**: si el número baja de 12, el conteo de 14 días vuelve a empezar.
- **Fuentes**: clientes y seguidores de Yagos Store, familia y amigos en Maracay y Valencia. Todos necesitan un Android y una cuenta de Google.
- **Google Group `pulso-testers`** como lista de la pista cerrada: se agrega gente sin tocar Play Console.
- **Lo que cuenta es inscribirse** por el enlace de la prueba; recibir la invitación no basta. Se verifica en Play Console el número de inscritos.
- **Grupo de WhatsApp** con los testers para avisar de las actualizaciones y hacer dos o tres preguntas por semana. Sus respuestas alimentan el cuestionario de producción.
- **Qué se les pide**: mantener la app instalada y el teléfono enchufado en casa, tocar "Se fue la luz" y "Volvió" cuando lo noten, responder las confirmaciones y decir si su router tiene UPS.
- **Antes de Play** (fase 8), la app se instala a mano en 2 o 3 teléfonos de la familia. No cuentan para el requisito de Google, pero dan datos de otras marcas.

## Trampas al instalar en Xiaomi

- `adb install` falla si no está activado "Instalar vía USB" en las opciones de desarrollador, y para activarlo hace falta una cuenta Mi y una SIM en el teléfono.
- Para que la app sobreviva hay que activar el "Inicio automático" y poner la batería en "Sin restricciones". La guía del onboarding lleva a esas pantallas.
