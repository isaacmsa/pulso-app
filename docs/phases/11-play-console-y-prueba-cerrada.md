# Fase 11 · Play Console y envío de la prueba cerrada

**Qué responde este documento**

- Qué hay que tener antes de enviar la prueba cerrada a revisión
- Qué pasos da Isaac en Play Console y qué le deja listo la sesión
- Qué se puede adelantar mientras la cuenta no esté pagada

| | |
| --- | --- |
| Se trabaja en | `pulso-app`. La huella de firma y el lote real tocan además `pulso-api` |
| Depende de | Las fases 7, 8, 9 y 10, y de que Play Console esté pagada y verificada |
| Puede ir a la vez que | «Se puede adelantar» no espera a nada |
| Trabajo estimado | 3 a 5 horas (estimación, sin medir) |
| Viene de | Fase 0 (corte C1), tarea 2b.3 (cortes C4 y C7), la huella de firma (B4) y la regla 5 del lote real |

El estado de la fase está en el tablero, `docs/roadmap.md`.

## Siguiente paso

Isaac paga Play Console cuando tenga los USD 25 y empieza la verificación. Mientras tanto se puede hacer «Se puede adelantar»: después del pago, juntar 12 testers es lo que más tarda.

## Lista cuando

- La prueba cerrada está en revisión.
- La prueba interna corre en el Xiaomi y en un segundo Android contra producción.

## Lo que necesita de Isaac

- [ ] **C1 · Pagar Play Console** (USD 25, una vez) con una tarjeta a su nombre legal, sin VPN, y pasar la verificación de identidad y la del teléfono (sirve el Xiaomi). Al 14 de noviembre no hay fondos.
- [ ] **Google Group `pulso-testers`** y reclutar 20 personas: hacen falta 12 inscritas durante 14 días seguidos. No depende del pago.
- [ ] **Crear la app en Play Console** con el paquete `com.isaacmendoza.pulso`, que es permanente, y activar Play App Signing.
- [ ] **Subir el AAB** a la prueba interna.
- [ ] **B4 · Pasar la huella SHA-256** de Play Console → Integridad de la app → Firma de apps. No es secreta.
- [ ] **Pegar la ficha y llenar los formularios** con los textos de `docs/play-store.md`.
- [ ] **Grabar el video del servicio en primer plano**, solo si D sigue en el manifiesto.
- [ ] **C7 · Enviar la prueba cerrada a revisión.**

## Tareas

### Se puede adelantar (no depende del pago)

- [ ] Mensaje de reclutamiento para el Google Group y para WhatsApp, e instrucciones de instalación para los testers. No existe ninguno de los dos.
- [ ] Al reclutar clientes de Yagos Store, avisarles que el modo UPS es experimental («Piloto con Yagos Store» en `docs/product.md`).

### Antes de crear la app

- [ ] Revisar de nuevo los requisitos de Play el día que se cree la cuenta: `docs/play-store.md` los verificó el 15 de octubre.
- [ ] Confirmar que Sentry está encendido en la app y en la API y que existe el monitor de UptimeRobot (C6 y B6, que vienen de las fases 9 y 7). Si faltan, van antes del AAB.
- [ ] Construir el AAB con el código ya cerrado por las fases 8 y 10: `eas build -p android --profile production`. EAS crea el keystore de subida.
- [ ] Lote real de esa versión en `pulso-api/test/fixtures/batches/` (regla 5). No hay comando que vuelque el lote tal cual sale del teléfono: se arma desde un exporte movido en el tiempo (`pnpm fixtures:shift`), con las claves `sentAt`, `diagnostics` y `events`, como `v0.1.0-spike.json`.
- [ ] Poner al día en `docs/play-store.md` la respuesta de IARC sobre interacción entre usuarios y la declaración de permisos según D-012.

### Con la app creada

- [ ] Huella de firma de Play: ponerla en `vars.ANDROID_CERT_SHA256` de producción en `pulso-api/wrangler.jsonc`, correr `pnpm cf-typegen` (si no, `ci` falla) y desplegar. `/.well-known/assetlinks.json` deja de dar 404 y los enlaces `/c/CODIGO` abren la app instalada desde Play. La variable acepta varias huellas separadas por coma; staging ya tiene la del keystore de EAS desde la fase 9.
- [ ] Prueba interna en el Xiaomi y en el segundo Android contra producción: onboarding, un corte simulado, push y enlace. Mirar que MIUI no apague «Inicio automático» al actualizar desde Play.
- [ ] Abrir `/privacidad` y `/borrar-datos` de producción desde un teléfono sin sesión antes de pegar las URL.
- [ ] Si D sigue en el manifiesto: declaración `specialUse` con la justificación y el video (el guion está en `docs/play-store.md`).
- [ ] Capturas enmarcadas, países de la prueba según dónde vivan los testers y notas de la versión.
- [ ] Mandar a los testers el enlace de inscripción y las instrucciones.

## Decisiones abiertas

| Decisión | Por qué importa | Si Isaac no decide |
| --- | --- | --- |
| ¿Plan B con una cuenta de organización? | Según `docs/play-store.md`, una cuenta de organización (por ejemplo, de Yagos Store) no tiene el requisito de los 12 testers. Tiene sus propios requisitos, que hay que revisar en Google | Se espera a tener los USD 25 |

## Apuntes

- Para Google cuenta inscribirse por el enlace de la prueba, no recibir la invitación.
- Play rechaza las fichas que prometen funciones que la app no tiene (D-034): la ficha describe lo que trae la versión que se envía.
- Si un tester vive fuera de Venezuela, su país tiene que estar en la lista de la prueba o no puede instalarla.

## Bitácora

- 13 nov 2026 · Fase creada al reorganizar el plan (D-046). Play Console no está pagada y no hay fecha para pagarla (D-045). El Google Group no está creado.
