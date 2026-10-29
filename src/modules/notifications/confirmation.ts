import * as Notifications from 'expo-notifications';
import { recordConfirmation } from '../power-detection/power-monitor';

/** La categoría que el backend pone en el push "¿Se fue la luz…?" (`categoryId: 'confirm_outage'`). */
export const CONFIRM_CATEGORY = 'confirm_outage';
const YES = 'yes';
const NO = 'no';

/**
 * Prepara las notificaciones: muestra los avisos que llegan con la app abierta y registra la categoría con Sí y No.
 * Los botones abren la app (D-028): una acción sin abrirla necesitaría un receiver propio, y abrirla es fiable en todos
 * los fabricantes. Llamarla una vez al arrancar; el registro de la categoría es idempotente.
 */
export async function setupNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await Notifications.setNotificationCategoryAsync(CONFIRM_CATEGORY, [
    { identifier: YES, buttonTitle: 'Sí', options: { opensAppToForeground: true } },
    { identifier: NO, buttonTitle: 'No', options: { opensAppToForeground: true } },
  ]);
}

// La misma respuesta llega dos veces: por el oyente y por `getLastNotificationResponse` al abrir la app. Se descarta por
// el identificador del aviso. Solo en memoria: tras reiniciar el proceso el sistema ya no entrega la respuesta vieja.
const handled = new Set<string>();

/** Solo para pruebas. */
export function resetConfirmationCache(): void {
  handled.clear();
}

/** Cuánto en el futuro se tolera un `outageStart` (relojes un poco desfasados). Kotlin exige lo mismo. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

/** `outageStart` del push: epoch ms entero, positivo y no futuro. Nada más vale, y el nativo lo vuelve a exigir. */
function parseOutageStart(data: unknown): number | null {
  if (typeof data !== 'object' || data === null) return null;
  const { type, outageStart } = data as { type?: unknown; outageStart?: unknown };
  if (type !== 'confirm') return null;
  return typeof outageStart === 'number' &&
    Number.isSafeInteger(outageStart) &&
    outageStart > 0 &&
    outageStart <= Date.now() + FUTURE_TOLERANCE_MS
    ? outageStart
    : null;
}

function handleResponse(response: Notifications.NotificationResponse): void {
  // Una respuesta ya vista no debe volver a entregarse (por ejemplo tras recargar JS): se borra de la "última".
  Notifications.clearLastNotificationResponse();
  const answer =
    response.actionIdentifier === YES ? true : response.actionIdentifier === NO ? false : null;
  if (answer === null) return; // tocar el cuerpo del aviso solo abre la app: no es una respuesta
  // Una respuesta que llega durante el onboarding se ignora a propósito: ese teléfono todavía no tiene token ni rol,
  // así que no hay cortes que confirmar (y el nativo tampoco guardaría nada útil).
  const { identifier, content } = response.notification.request;
  const outageStart = parseOutageStart(content.data);
  if (outageStart === null || handled.has(identifier)) return;

  handled.add(identifier);
  void save(identifier, outageStart, answer);
}

async function save(identifier: string, outageStart: number, answer: boolean): Promise<void> {
  try {
    await recordConfirmation(outageStart, answer);
  } catch (error) {
    // No se guardó y el aviso sigue en la bandeja: otro toque debe poder intentarlo de nuevo.
    handled.delete(identifier);
    console.warn('No se pudo guardar la confirmación', error);
    return;
  }
  try {
    // Los botones de acción no descartan el aviso: sin esto, otro toque (aun en otro proceso) guardaría otra
    // confirmación con un UUID nuevo. Ya está guardada, así que `identifier` sigue en `handled`.
    await Notifications.dismissNotificationAsync(identifier);
  } catch (error) {
    console.warn('No se pudo descartar el aviso respondido', error);
  }
}

/**
 * Escucha las respuestas Sí y No y las guarda con `recordConfirmation`. También recoge la que abrió la app desde
 * cerrada. Devuelve cómo dejar de escuchar.
 */
export function startConfirmationResponses(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    handleResponse(last);
    Notifications.clearLastNotificationResponse();
  }
  return () => subscription.remove();
}
