import { isValidCode, normalizeCode, shareMessage } from '../code';

it('el código se normaliza a mayúsculas y rechaza letras fuera del alfabeto', () => {
  expect(normalizeCode(' abcd-2345 ')).toBe('ABCD2345');
  expect(isValidCode('ABCD2345')).toBe(true);
  // El alfabeto de la API no tiene 0, 1, I, L ni O.
  for (const bad of ['ABCD2340', 'ABCD2341', 'ABCDI234', 'ABCDL234', 'ABCDO234']) {
    expect(isValidCode(bad)).toBe(false);
  }
  expect(isValidCode('ABCD234')).toBe(false);
  expect(isValidCode('ABCD23456')).toBe(false);
  expect(isValidCode('')).toBe(false);
});

describe('el enlace sigue a la API de la build', () => {
  const original = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = original;
  });

  it('en producción el enlace usa el host de producción', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://pulso-api.isaac-mendozasa.workers.dev/';
    expect(shareMessage('ABCD2345')).toBe(
      'Sigue la luz de mi casa en Pulso: https://pulso-api.isaac-mendozasa.workers.dev/c/ABCD2345',
    );
  });

  it('en staging el enlace usa el host de staging', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://pulso-api-staging.isaac-mendozasa.workers.dev';
    expect(shareMessage('ABCD2345')).toBe(
      'Sigue la luz de mi casa en Pulso: https://pulso-api-staging.isaac-mendozasa.workers.dev/c/ABCD2345',
    );
  });

  it('sin variable usa staging, igual que el cliente de la API', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(shareMessage('ABCD2345')).toContain(
      'https://pulso-api-staging.isaac-mendozasa.workers.dev/c/',
    );
  });
});
