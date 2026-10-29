import AsyncStorage from '@react-native-async-storage/async-storage';
import { unwrap } from '../../shared/api/client';
import { updateHome } from '../../shared/api/generated';

// `GET /v1/homes/me/status` no trae el modo, así que el interruptor recuerda aquí el último valor que el servidor
// aceptó. No es un secreto (regla 3 no aplica) y "Borrar mis datos" lo limpia.
export const UPS_MODE_KEY = 'pulso-router-ups';

// Último valor que el servidor aceptó, en memoria: si el disco falla, el interruptor no muestra otra cosa.
let accepted: boolean | null = null;

/** El último modo que se fijó en el servidor desde este teléfono. Sin dato, `base`. */
export async function readUpsMode(): Promise<boolean> {
  if (accepted !== null) return accepted;
  try {
    return (await AsyncStorage.getItem(UPS_MODE_KEY)) === 'ups';
  } catch {
    return false;
  }
}

/**
 * Fija el modo en el servidor. Lanza `ApiError` si no lo aceptó. Devuelve `false` si el servidor lo aceptó pero no
 * se pudo recordar en el disco (el valor aceptado queda en memoria).
 */
export async function setUpsMode(enabled: boolean): Promise<boolean> {
  const mode = enabled ? 'ups' : 'base';
  await unwrap(updateHome({ body: { mode } }));
  accepted = enabled;
  try {
    await AsyncStorage.setItem(UPS_MODE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}

/** Olvida el modo. Nunca lanza: una falla del disco no debe impedir el resto del borrado. */
export async function clearUpsMode(): Promise<void> {
  accepted = null;
  await AsyncStorage.removeItem(UPS_MODE_KEY).catch(() => undefined);
}
