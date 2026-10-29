import AsyncStorage from '@react-native-async-storage/async-storage';
import { unwrap } from '../../shared/api/client';
import { updateHome } from '../../shared/api/generated';

// `GET /v1/homes/me/status` no trae el modo, así que el interruptor recuerda aquí el último valor que el servidor
// aceptó. No es un secreto (regla 3 no aplica) y "Borrar mis datos" lo limpia.
export const UPS_MODE_KEY = 'pulso-router-ups';

/** El último modo que se fijó en el servidor desde este teléfono. Sin dato, `base`. */
export async function readUpsMode(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(UPS_MODE_KEY)) === 'ups';
  } catch {
    return false;
  }
}

/** Fija el modo en el servidor y, solo si lo aceptó, lo recuerda. Lanza `ApiError` si falla. */
export async function setUpsMode(enabled: boolean): Promise<void> {
  const mode = enabled ? 'ups' : 'base';
  await unwrap(updateHome({ body: { mode } }));
  await AsyncStorage.setItem(UPS_MODE_KEY, mode).catch(() => undefined);
}

export async function clearUpsMode(): Promise<void> {
  await AsyncStorage.removeItem(UPS_MODE_KEY);
}
