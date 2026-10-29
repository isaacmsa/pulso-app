import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, focusManager, QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { AppState } from 'react-native';
import { ApiError } from '../api/client';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RETRYABLE = new Set(['network', 'timeout', 'internal_error', 'rate_limited']);

// D-024: el cliente HTTP no reintenta; los reintentos de las pantallas los hace TanStack Query, y solo ante
// fallas que pueden pasar solas. Una respuesta que no cumple el contrato no mejora reintentando.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && error instanceof ApiError && RETRYABLE.has(error.code);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime >= maxAge: si no, la caché restaurada se descarta antes de poder usarse.
    queries: { retry: shouldRetry, staleTime: 30_000, gcTime: WEEK_MS },
  },
});

// Volver a la app cuenta como "volver a enfocar": refresca lo que esté viejo.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) =>
    handleFocus(state === 'active'),
  );
  return () => subscription.remove();
});

const PERSIST_KEY = 'pulso-query-cache';

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: PERSIST_KEY });

// Solo el historial se guarda en el disco, para verlo sin red. El estado de la casa sale del nativo
// (`getLastServerStatus`), y el rol y lo del teléfono se leen del nativo cada vez. Nada de esto lleva el token:
// son respuestas del servidor y el token nunca pasa por la caché (regla 3).
// `buster` ata la copia del disco a la versión de la app: una versión nueva puede cambiar la forma de lo guardado, y
// TanStack descarta la caché de otra versión en lugar de restaurarla.
export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister,
  maxAge: WEEK_MS,
  buster: Constants.expoConfig?.version ?? '0.0.0',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) &&
      query.queryKey[0] === 'home' &&
      query.queryKey[1] === 'outages',
  },
};

/** "Borrar mis datos": vacía la caché en memoria y la copia del disco. */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  await persister.removeClient();
}
