import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { unwrap } from '../../shared/api/client';
import { updateDevice } from '../../shared/api/generated';
import { getToken } from '../power-detection/power-monitor';

/** El canal al que el backend manda todos los avisos (`channelId: 'cortes'`, prioridad alta). */
export const CHANNEL_ID = 'cortes';

async function ensureChannel(): Promise<void> {
  // Android 13+ pide crear al menos un canal antes del permiso y del token, y solo `name` y `description` se pueden
  // cambiar después de crearlo: la importancia alta tiene que quedar bien desde el principio.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Cortes de luz',
    description: 'Cuando se va y cuando vuelve la luz en la casa que sigues',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

// Lo último que aceptó el servidor, atado al token del dispositivo que lo recibió: si el teléfono se registra de nuevo
// (dispositivo nuevo), hay que mandarlo otra vez. Solo en memoria: una vez por arranque basta, y así nunca queda un
// "ya lo mandé" viejo en el disco.
let lastSent: { deviceToken: string; pushToken: string } | null = null;
let inFlight: Promise<void> | null = null;

/** Solo para pruebas. */
export function resetPushTokenCache(): void {
  lastSent = null;
  inFlight = null;
}

/**
 * Manda el push token de Expo al servidor (`PATCH /v1/devices/me`). Corre al abrir la app y cada vez que el sistema
 * rota el token. También los teléfonos que solo siguen una casa: los avisos les llegan a ellos.
 *
 * No pide el permiso (eso es del onboarding): sin permiso no hace nada. Tampoco falla sin `extra.eas.projectId`
 * (todavía no hay cuenta de Expo): lo anota una vez y sigue. Nunca lanza, y nunca escribe el token en los logs.
 * Dos llamadas a la vez comparten el mismo trabajo, y un token que no cambió no se manda otra vez.
 */
export function registerPushToken(): Promise<void> {
  inFlight ??= run()
    .catch((error: unknown) => {
      // El mensaje de un ApiError o de Expo no lleva el token. Se reintenta en la próxima apertura o rotación.
      console.warn('No se pudo registrar el push token', error);
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function run(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await ensureChannel();

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  const deviceToken = await getToken();
  if (!deviceToken) return; // todavía no se registró (o el Keystore no respondió): no hay con qué autenticarse

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.info('Push token omitido: falta extra.eas.projectId (aún no hay cuenta de Expo)');
    return;
  }

  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (lastSent?.deviceToken === deviceToken && lastSent.pushToken === pushToken) return;
  await unwrap(updateDevice({ body: { pushToken } }));
  lastSent = { deviceToken, pushToken };
}

/** Vuelve a registrar cuando el sistema rota el token de FCM mientras la app está abierta. Devuelve cómo dejar de escuchar. */
export function startPushTokenSync(): () => void {
  const subscription = Notifications.addPushTokenListener(() => {
    void registerPushToken();
  });
  return () => subscription.remove();
}
