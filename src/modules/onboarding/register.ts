import Constants from 'expo-constants';
import { ApiError, resolveApiUrl, unwrap } from '../../shared/api/client';
import { createHome, registerDevice } from '../../shared/api/generated';
import {
  arm,
  configureApi,
  getToken,
  isTokenInvalid,
  type Role,
  requestUpload,
  setOnboardingStep,
  setRole,
  storeToken,
} from '../power-detection/power-monitor';

let inFlight: Promise<void> | null = null;

/**
 * Registra este teléfono y lo deja listo para su rol (D-026). Es idempotente: con un token válido no registra
 * otro dispositivo, solo termina lo que falte, y dos llamadas a la vez comparten el mismo trabajo.
 *
 * - `follow`: el rol se guarda primero y nunca se arma la detección, ni se crea casa, ni se pide subir.
 * - `watch`: arma la detección, crea la casa (`home_exists` cuenta como éxito) y pide subir ya, para que los
 *   primeros eventos no esperen al próximo latido. El rol se guarda al final: es la marca de "registro completo",
 *   así que un registro que se cortó a medias vuelve al onboarding en el próximo arranque.
 *
 * Antes de empezar anota el paso pendiente (`role`) y al terminar el siguiente (`notifications`), para que, si
 * el sistema mata la app en medio del onboarding, se retome ahí sin registrar de nuevo.
 */
export function register(role: Role): Promise<void> {
  inFlight ??= run(role).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(role: Role): Promise<void> {
  await setOnboardingStep('role');
  await registerAndArm(role);
  await setOnboardingStep('notifications');
}

async function registerAndArm(role: Role): Promise<void> {
  if (role === 'follow') await setRole('follow');

  const token = await getToken();
  if (!token || (await isTokenInvalid())) {
    const registered = await unwrap(
      registerDevice({ body: { appVersion: Constants.expoConfig?.version ?? '0.0.0' } }),
    );
    await storeToken(registered.token);
  }
  await configureApi(resolveApiUrl(process.env.EXPO_PUBLIC_API_URL));
  if (role === 'follow') return;

  await arm();
  try {
    await unwrap(createHome({ body: {} }));
  } catch (error) {
    if (!(error instanceof ApiError && error.code === 'home_exists')) throw error;
  }
  await setRole('watch');
  await requestUpload();
}
