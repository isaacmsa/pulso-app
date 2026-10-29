import { ApiError, unwrap } from '../../shared/api/client';
import { deleteDevice } from '../../shared/api/generated';
import { clearQueryCache } from '../../shared/query/client';
import { notifyStartupChanged } from '../onboarding/startup';
import { wipe } from '../power-detection/power-monitor';

export class WipeError extends Error {
  constructor() {
    super('No se pudo limpiar este teléfono');
    this.name = 'WipeError';
  }
}

/**
 * "Borrar mis datos". Primero el servidor (`deleteDevice`) y, solo si responde 204, el teléfono: hasta entonces no se
 * toca nada local, así que sin red se puede reintentar sin perder nada. Un 401 también cuenta: el servidor ya no
 * reconoce el dispositivo (se borró en un intento anterior que no alcanzó a limpiar el teléfono), no hay más que
 * borrar allá. Al final avisa a la raíz, que vuelve al onboarding porque ya no hay token (el rol queda en `follow`, así
 * nada se vuelve a armar solo hasta que la persona elija de nuevo).
 *
 * Lanza `ApiError` si el servidor no confirmó (no se tocó nada local) o `WipeError` si el servidor sí borró pero el
 * teléfono no pudo limpiarse del todo (repetirlo es seguro).
 */
export async function deleteMyData(): Promise<void> {
  try {
    await unwrap(deleteDevice());
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
  }
  try {
    // La caché primero: si la app muere entre los dos pasos, no queda el historial de esta casa en el disco.
    await clearQueryCache();
    await wipe();
  } catch {
    throw new WipeError();
  }
  notifyStartupChanged();
}
