import { ApiError, unwrap } from '../../shared/api/client';
import { deleteDevice } from '../../shared/api/generated';
import { clearQueryCache } from '../../shared/query/client';
import { notifyStartupChanged } from '../onboarding/startup';
import { getToken, wipe } from '../power-detection/power-monitor';

/** La página pública para pedir el borrado sin la app (la misma que declara la ficha de Play). */
export const DELETE_DATA_URL = 'https://pulso-api.isaac-mendozasa.workers.dev/borrar-datos';

/** No hay token en la bóveda: el servidor no puede confirmar el borrado, así que no se tocó nada. */
export class NoTokenError extends Error {
  constructor() {
    super('Este teléfono no tiene token para pedir el borrado');
    this.name = 'NoTokenError';
  }
}

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
 * Sin token no se llama a la API ni se borra nada: el pedido saldría sin `Authorization`, el 401 contaría como
 * confirmado y el teléfono quedaría limpio con la copia del servidor intacta (excepción de D-031).
 *
 * Lanza `NoTokenError` si no hay token, `ApiError` si el servidor no confirmó (en los dos no se tocó nada local) o
 * `WipeError` si el servidor sí borró pero el teléfono no pudo limpiarse del todo (repetirlo es seguro).
 */
export async function deleteMyData(): Promise<void> {
  if (!(await getToken())) throw new NoTokenError();
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
