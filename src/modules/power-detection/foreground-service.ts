import { PermissionsAndroid, Platform } from 'react-native';
import { setForegroundServiceEnabled } from './power-monitor';

/**
 * Enciende o apaga el servicio en primer plano (mecanismo D). Encenderlo pide el permiso de notificaciones desde
 * Android 13 (API 33); antes no existe. Devuelve `no_permission` si la persona lo negó, sin tocar el servicio.
 */
export async function requestForegroundService(enabled: boolean): Promise<'ok' | 'no_permission'> {
  if (enabled && Number(Platform.Version) >= 33) {
    const result = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
    if (result !== PermissionsAndroid.RESULTS.GRANTED) return 'no_permission';
  }
  await setForegroundServiceEnabled(enabled);
  return 'ok';
}
