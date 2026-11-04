import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { unwrap } from '../../shared/api/client';
import { updateDevice } from '../../shared/api/generated';

// La versión que el servidor ya conoce. El registro manda la del primer arranque y nadie la actualizaba: tras pasar a la
// 0.2.0, `devices.app_version` seguía en 0.1.0 (sesión C3). No es un secreto.
export const REPORTED_VERSION_KEY = 'pulso-reported-app-version';

/** Manda la versión instalada si cambió desde la última vez. Nunca lanza: si falla, se reintenta en el próximo arranque. */
export async function reportAppVersion(): Promise<void> {
  const version = Constants.expoConfig?.version;
  if (!version) return;
  try {
    if ((await AsyncStorage.getItem(REPORTED_VERSION_KEY)) === version) return;
    await unwrap(updateDevice({ body: { appVersion: version } }));
    await AsyncStorage.setItem(REPORTED_VERSION_KEY, version);
  } catch (error) {
    console.warn('No se pudo reportar la versión de la app', error);
  }
}
