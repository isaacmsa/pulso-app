import { useEffect, useState } from 'react';
import { setInvalidTokenHandler } from '../../shared/api/client';
import {
  getOnboardingStep,
  getRole,
  getTokenState,
  isTokenInvalid,
  markTokenInvalid,
} from '../power-detection/power-monitor';

/** A dónde va la app al arrancar: al onboarding, o a la app con el rol que eligió la persona. */
export type Startup = 'onboarding' | 'watch' | 'follow';

/** Cada cuánto se vuelve a leer el token mientras el Keystore falla de forma pasajera. */
export const RETRY_TRANSIENT_MS = 30_000;

type Resolution = { startup: Startup; retry: boolean };

/**
 * Pide onboarding si no hay token (también el registrador de la fase 0, que nunca se registró), si no se puede leer
 * para siempre (clave invalidada o datos corruptos), si el servidor lo rechazó, si hay token pero no rol (el registro
 * se cortó a medias) o si queda un paso pendiente (la app murió en medio del onboarding, por ejemplo en los ajustes de
 * batería). Un teléfono registrado antes de la marca de pasos no tiene paso pendiente: cuenta como terminado.
 *
 * Una falla pasajera del Keystore (`transient`) no es ausencia: registrar de nuevo crearía otra casa y soltaría a los
 * seguidores (D-030). Se muestra la app con el rol guardado (o "follow", que no arma nada, si aún no hay) y se
 * reintenta más tarde. Si el nativo falla del todo, onboarding: es más seguro volver a preguntar que seguir a ciegas.
 */
async function resolve(): Promise<Resolution> {
  try {
    const tokenState = await getTokenState();
    if (tokenState === 'transient') {
      return { startup: (await getRole()) ?? 'follow', retry: true };
    }
    const [invalid, role, step] = await Promise.all([
      isTokenInvalid(),
      getRole(),
      getOnboardingStep(),
    ]);
    if (tokenState !== 'present' || invalid || role === null || step !== null) {
      return { startup: 'onboarding', retry: false };
    }
    return { startup: role, retry: false };
  } catch (error) {
    console.warn('No se pudo leer el estado del registro', error);
    return { startup: 'onboarding', retry: false };
  }
}

export async function resolveStartup(): Promise<Startup> {
  return (await resolve()).startup;
}

const listeners = new Set<() => void>();

/** El onboarding avisa que terminó (o que algo cambió) para que la raíz vuelva a decidir a dónde ir. */
export function notifyStartupChanged(): void {
  for (const listener of listeners) listener();
}

/**
 * El servidor rechazó el token de una llamada con sesión (I3): se marca en el nativo (solo si sigue siendo el guardado) y
 * la raíz vuelve a decidir; con el token marcado, el arranque manda al onboarding y `register()` registra de nuevo. Un
 * teléfono que solo sigue una casa nunca sube, así que sin esto no se enteraría y el servidor lo borra a los 7 días.
 */
export function installInvalidTokenHandler(): void {
  setInvalidTokenHandler(async (sentToken) => {
    await markTokenInvalid(sentToken);
    notifyStartupChanged();
  });
}

/** `null` mientras se lee el estado. Se actualiza cuando el onboarding avisa con `notifyStartupChanged`. */
export function useStartup(): Startup | null {
  const [startup, setStartup] = useState<Startup | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      clearTimeout(timer);
      void resolve().then(({ startup: next, retry }) => {
        if (!alive) return;
        setStartup(next);
        if (retry) timer = setTimeout(load, RETRY_TRANSIENT_MS);
      });
    };
    listeners.add(load);
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
      listeners.delete(load);
    };
  }, []);
  return startup;
}
