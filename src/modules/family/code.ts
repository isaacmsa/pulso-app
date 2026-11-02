import { resolveApiUrl } from '../../shared/api/client';

// El alfabeto de los códigos de casa de la API: sin 0, 1, I, L ni O, para que no se confundan al dictarlos.
const CODE_PATTERN = /^[2-9A-HJKMNP-Z]{8}$/;

/**
 * Dónde vive la página pública `/c/:code` (lo que se manda por WhatsApp, D-030): la misma API que usa la build, así
 * un código de staging no termina en un enlace de producción que no lo conoce. Expo solo reemplaza la variable si se
 * escribe literal.
 */
export function shareBaseUrl(): string {
  return resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);
}

/** Las casas que se pueden seguir a la vez (el servidor rechaza la 21 con `validation_failed`). */
export const MAX_FOLLOWS = 20;

/** Lo que escribe la persona, listo para validar: mayúsculas y sin espacios ni guiones. */
export function normalizeCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export function shareMessage(code: string): string {
  return `Sigue la luz de mi casa en Pulso: ${shareBaseUrl()}/c/${code}`;
}
