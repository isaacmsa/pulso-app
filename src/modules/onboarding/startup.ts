import { useEffect, useState } from 'react';
import {
  getOnboardingStep,
  getRole,
  getToken,
  isTokenInvalid,
} from '../power-detection/power-monitor';

/** A dónde va la app al arrancar: al onboarding, o a la app con el rol que eligió la persona. */
export type Startup = 'onboarding' | 'watch' | 'follow';

/**
 * Pide onboarding si no hay token (también el registrador de la fase 0, que nunca se registró), si el servidor
 * lo rechazó, si hay token pero no rol (el registro se cortó a medias) o si queda un paso pendiente (la app murió
 * en medio del onboarding, por ejemplo en los ajustes de batería). Un teléfono registrado antes de la marca de pasos
 * no tiene paso pendiente: cuenta como terminado. Si el nativo falla, también: es más
 * seguro volver a preguntar que seguir a ciegas.
 */
export async function resolveStartup(): Promise<Startup> {
  try {
    const [token, invalid, role, step] = await Promise.all([
      getToken(),
      isTokenInvalid(),
      getRole(),
      getOnboardingStep(),
    ]);
    if (!token || invalid || role === null || step !== null) return 'onboarding';
    return role;
  } catch (error) {
    console.warn('No se pudo leer el estado del registro', error);
    return 'onboarding';
  }
}

const listeners = new Set<() => void>();

/** El onboarding avisa que terminó (o que algo cambió) para que la raíz vuelva a decidir a dónde ir. */
export function notifyStartupChanged(): void {
  for (const listener of listeners) listener();
}

/** `null` mientras se lee el estado. Se actualiza cuando el onboarding avisa con `notifyStartupChanged`. */
export function useStartup(): Startup | null {
  const [startup, setStartup] = useState<Startup | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      void resolveStartup().then((next) => {
        if (alive) setStartup(next);
      });
    };
    listeners.add(load);
    load();
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, []);
  return startup;
}
