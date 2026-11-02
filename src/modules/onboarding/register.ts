import Constants from 'expo-constants';
import { ApiError, resolveApiUrl, unwrap } from '../../shared/api/client';
import { createHome, registerDevice } from '../../shared/api/generated';
import { saveShareCode } from '../family/share-code';
import {
  arm,
  configureApi,
  getToken,
  getTokenState,
  isTokenInvalid,
  markTokenInvalid,
  type Role,
  requestUpload,
  setOnboardingStep,
  setRole,
  storeToken,
} from '../power-detection/power-monitor';

/** El Keystore falló de forma pasajera: no se sabe si hay token, y registrar de nuevo crearía otra casa (D-030). */
export class TokenUnavailableError extends Error {
  constructor() {
    super('El teléfono no pudo leer su token ahora mismo');
    this.name = 'TokenUnavailableError';
  }
}

let inFlight: Promise<void> | null = null;

/**
 * Registra este teléfono y lo deja listo para su rol (D-026). Es idempotente: con un token válido no registra
 * otro dispositivo, solo termina lo que falte, y dos llamadas a la vez comparten el mismo trabajo.
 *
 * - Guarda el rol primero. `follow` desarma lo que hubiera armado y nunca arma la detección, ni crea casa, ni
 *   pide subir.
 * - `watch`: arma la detección, crea la casa (`home_exists` cuenta como éxito) y pide subir ya, para que los
 *   primeros eventos no esperen al próximo latido.
 * - Si el servidor rechaza el token (`invalid_token`: el teléfono lo cree válido pero allá ya no existe), lo marca
 *   inválido en el nativo y registra de nuevo una sola vez; si el token nuevo también falla, el error se propaga.
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
  // El rol va primero. Con "follow", nada puede armarse en medio. Con "watch", `ensureArmed` (dentro de arm) ya no
  // sale temprano si venía de "follow", y el teléfono queda armado durante los pasos siguientes aunque la app muera.
  await setRole(role);

  const token = await ensureRegistered();
  await configureApi(resolveApiUrl(process.env.EXPO_PUBLIC_API_URL));
  if (role === 'follow') return;

  await arm();
  try {
    await createHomeIfMissing();
  } catch (error) {
    if (!(error instanceof ApiError && (error.code === 'invalid_token' || error.status === 401))) {
      throw error;
    }
    await markTokenInvalid(token);
    await ensureRegistered();
    await createHomeIfMissing();
  }
  await requestUpload();
}

/**
 * El token guardado si sigue válido; si no hay, es ilegible para siempre o el servidor lo rechazó, registra este
 * teléfono y guarda el nuevo. Con una falla pasajera del Keystore no registra: lanza `TokenUnavailableError`.
 */
async function ensureRegistered(): Promise<string> {
  const tokenState = await getTokenState();
  if (tokenState === 'transient') throw new TokenUnavailableError();
  if (tokenState === 'present' && !(await isTokenInvalid())) {
    const token = await getToken();
    if (!token) throw new TokenUnavailableError();
    return token;
  }
  const registered = await unwrap(
    registerDevice({ body: { appVersion: Constants.expoConfig?.version ?? '0.0.0' } }),
  );
  await storeToken(registered.token);
  return registered.token;
}

async function createHomeIfMissing(): Promise<void> {
  try {
    // `register` ya maneja el 401 (marca el token y registra de nuevo), así que el aviso global sobra.
    const home = await unwrap(createHome({ body: {} }), { handleInvalidToken: false });
    // El servidor solo entrega el código aquí y al regenerarlo: se recuerda para poder compartirlo (Familia).
    await saveShareCode(home.shareCode);
  } catch (error) {
    if (!(error instanceof ApiError && error.code === 'home_exists')) throw error;
  }
}
