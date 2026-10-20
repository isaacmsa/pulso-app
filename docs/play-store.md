# Publicación en Google Play

**Qué responde este documento**

- Qué exige Google a una cuenta personal nueva
- En qué orden y en qué fecha se hace cada paso
- Cómo se recluta y se cuida a los testers

Los requisitos se verificaron el 15 de octubre de 2026. Revisarlos de nuevo el día que se cree la cuenta.

## Calendario

| Fecha | Paso |
| --- | --- |
| Antes del 31 oct | Cuenta personal creada y pagada (USD 25, el único pago del proyecto); verificación de identidad y del dispositivo Android en curso |
| 26 oct en adelante | Reclutamiento de testers (Google Group) |
| 9 al 19 nov | App creada en Play Console, prueba interna, ficha y formularios |
| 18 o 19 nov | Prueba cerrada enviada a revisión |
| ~21 nov | Prueba cerrada aprobada; testers inscritos (meta: 15 o más) |
| ~27 nov y ~4 dic | Actualizaciones 1 y 2 publicadas en la pista cerrada |
| ~5 dic | 14 días seguidos con 12 o más testers |
| ~5 o 6 dic | Solicitud de acceso a producción |
| ~12 dic | Aprobación (Google puede tardar hasta 7 días o más) |
| ~13 al 15 dic | Lanzamiento escalonado: 20%, y 100% tras 48 h sin errores graves en Sentry |
| 16 al 21 dic | Colchón ante un rechazo |

## Pasos

- [ ] **Cuenta personal** de Play Console: pago único de USD 25 con una tarjeta que funcione en el exterior y esté a tu nombre legal. Luego verificación de identidad con documento y teléfono, y verificación desde un dispositivo Android con la app de Play Console (sirve el Xiaomi) ([Google](https://support.google.com/googleplay/android-developer/answer/6112435?hl=es)). Registrarse sin VPN y sin otro país: si el perfil de pagos no coincide con la identidad, se puede perder la cuenta. Plan B si el pago falla desde Venezuela: publicar con la cuenta de una organización (por ejemplo, Yagos Store) e invitarte como miembro. Las cuentas de organización no tienen el requisito de los 12 testers.
- [ ] **Nombre del paquete** `com.isaacmendoza.pulso` (D-010). Es permanente desde la primera subida.
- [ ] **Nivel de API**: las apps nuevas deben apuntar a Android 16, API 36, desde el 31 de agosto de 2026 ([Google](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-419)). Probar también el gesto de retroceso predictivo.
- [ ] **Play App Signing** activo. EAS genera el keystore de subida.
- [ ] **Política de privacidad** publicada en `https://pulso-api.<subdominio>.workers.dev/privacidad`, y la página de borrado en `/borrar-datos` (ver `docs/security-privacy.md`).
- [ ] **Formularios**: seguridad de datos, clasificación de contenido, público objetivo (adultos), acceso a la app (no requiere inicio de sesión), anuncios (no) y declaración de permisos. Si D-012 deja el servicio `specialUse`, se declara con una descripción y un video corto que muestre la notificación y para qué sirve.
- [ ] **Ficha** en español: nombre ("Pulso: cortes de luz" si "Pulso" está tomado), descripción corta, descripción larga que explique la detección automática en una frase, ícono de 512 px, gráfico destacado de 1024 × 500 y capturas reales del Xiaomi.
- [ ] **Prueba interna** para ti y la familia (hasta 100 personas, sin revisión) desde que exista el primer AAB.
- [ ] **Prueba cerrada**: al menos 12 testers inscritos durante 14 días seguidos ([Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)).
- [ ] **Solicitud de acceso a producción**, respondiendo el cuestionario con datos concretos de la prueba: cuántos testers, qué reportaron y qué se cambió en cada actualización.
- [ ] **Lanzamiento escalonado**.

## Testers

- **Reclutar 20, no 12**: si el número baja de 12, el conteo de 14 días vuelve a empezar.
- **Fuentes**: clientes y seguidores de Yagos Store, familia y amigos en Maracay y Valencia. Todos necesitan un Android y una cuenta de Google.
- **Google Group `pulso-testers`** como lista de la pista cerrada: se agrega gente sin tocar Play Console.
- **Lo que cuenta es inscribirse** por el enlace de la prueba; recibir la invitación no basta. Se verifica en Play Console el número de inscritos.
- **Grupo de WhatsApp** con los testers para avisar de las actualizaciones y hacer dos o tres preguntas por semana. Sus respuestas alimentan el cuestionario de producción.
- **Qué se les pide**: mantener la app instalada y el teléfono enchufado en casa, tocar "Se fue la luz" y "Volvió" cuando lo noten, responder las confirmaciones y decir si su router tiene UPS.
- **Antes de Play**, en las semanas 2 a 4, el APK del registrador se instala a mano en 2 o 3 teléfonos de la familia. No cuentan para el requisito de Google, pero dan datos de otras marcas.

## Trampas al instalar en Xiaomi

- `adb install` falla si no está activado "Instalar vía USB" en las opciones de desarrollador, y para activarlo hace falta una cuenta Mi y una SIM en el teléfono.
- Para que la app sobreviva hay que activar el "Inicio automático" y poner la batería en "Sin restricciones". La guía del onboarding lleva a esas pantallas.
