import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient para las pruebas de pantallas: sin reintentos y sin recolección de basura. Con el `gcTime` por defecto
 * (5 min), cada consulta que queda sin observadores deja un temporizador vivo, Jest no puede cerrar el worker y avisa
 * "A worker process has failed to exit gracefully". Con `Infinity`, TanStack no agenda ese temporizador.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { gcTime: Number.POSITIVE_INFINITY },
    },
  });
}
