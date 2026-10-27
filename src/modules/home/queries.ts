import { useQuery } from '@tanstack/react-query';
import { ApiError, unwrap } from '../../shared/api/client';
import { getHomeStatus, getOutages } from '../../shared/api/generated';
import type { HomeStatus } from '../../shared/api/generated/types.gen';
import { getLastServerStatus, getRole, readEvents } from '../power-detection/power-monitor';

export type HomeStatusResult = {
  status: HomeStatus;
  /** null: lo acaba de dar el servidor. Con valor: es el último estado guardado en el teléfono y llegó a esa hora. */
  receivedAt: number | null;
};

/**
 * El estado de mi casa. Sin red (o con timeout) cae en el último estado que el servidor dio a la subida en segundo
 * plano, con su hora, para que la pantalla diga "hace 20 min" (D-016, D-027). Cualquier otra falla se muestra.
 */
export async function fetchHomeStatus(): Promise<HomeStatusResult> {
  try {
    return { status: await unwrap(getHomeStatus()), receivedAt: null };
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'network' || error.code === 'timeout')) {
      const last = await getLastServerStatus().catch(() => null);
      if (last) return { status: last.status, receivedAt: last.receivedAt };
    }
    throw error;
  }
}

export function useHomeStatus() {
  return useQuery({ queryKey: ['home', 'status'], queryFn: fetchHomeStatus });
}

/** Cortes y resumen por día entre `from` y `to` (epoch ms, de a lo sumo 92 días). */
export function useOutages(from: number, to: number) {
  return useQuery({
    queryKey: ['home', 'outages', from, to],
    queryFn: () => unwrap(getOutages({ query: { from, to } })),
  });
}

/** Qué rol eligió la persona: `watch` (vigila su casa) o `follow` (solo sigue). */
export function useRole() {
  return useQuery({ queryKey: ['role'], queryFn: getRole, staleTime: 0 });
}

const PHONE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** Lo que el teléfono guardó, para decir el estado crudo (cuándo dejó de estar en corriente). */
export function usePhoneEvents() {
  return useQuery({
    queryKey: ['phone', 'events'],
    queryFn: () => readEvents(Date.now() - PHONE_WINDOW_MS).then((result) => result.events),
  });
}
