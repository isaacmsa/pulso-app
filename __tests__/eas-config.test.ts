import app from '../app.json';
import easJson from '../eas.json';
import { STAGING_API_URL } from '../src/shared/api/client';

const PRODUCTION_API_URL = 'https://pulso-api.isaac-mendozasa.workers.dev';

type Profile = {
  developmentClient?: boolean;
  distribution?: string;
  autoIncrement?: boolean;
  env?: Record<string, string>;
  android?: { buildType?: string };
};
type EasConfig = {
  cli?: { appVersionSource?: string };
  build: Record<string, Profile>;
};

const eas = easJson as EasConfig;
const profiles = ['development', 'preview', 'production'];

function profile(name: string): Profile {
  const found = eas.build[name];
  if (!found) throw new Error(`Falta el perfil ${name}`);
  return found;
}

it('define los tres perfiles', () => {
  expect(Object.keys(eas.build).sort()).toEqual([...profiles].sort());
});

it('cada perfil define EXPO_PUBLIC_API_URL', () => {
  for (const name of profiles) {
    expect(profile(name).env?.EXPO_PUBLIC_API_URL).toMatch(/^https:\/\//);
  }
});

it('production apunta a producción y genera AAB', () => {
  const production = profile('production');
  expect(production.env?.EXPO_PUBLIC_API_URL).toBe(PRODUCTION_API_URL);
  // Sin buildType, EAS genera AAB (el formato que exige Play).
  expect([undefined, 'app-bundle']).toContain(production.android?.buildType);
  expect(production.developmentClient).not.toBe(true);
  expect(production.autoIncrement).toBe(true);
});

it('preview y development apuntan a staging y generan APK', () => {
  for (const name of ['preview', 'development']) {
    expect(profile(name).env?.EXPO_PUBLIC_API_URL).toBe(STAGING_API_URL);
    expect(profile(name).android?.buildType).toBe('apk');
    expect(profile(name).distribution).toBe('internal');
  }
  expect(profile('development').developmentClient).toBe(true);
  expect(profile('preview').developmentClient).not.toBe(true);
});

it('la versión de compilación la lleva EAS y app.json no fija versionCode', () => {
  expect(eas.cli?.appVersionSource).toBe('remote');
  expect((app.expo.android as { versionCode?: number }).versionCode).toBeUndefined();
});

it('ningún EXPO_PUBLIC_* parece un secreto', () => {
  for (const name of profiles) {
    for (const [key, value] of Object.entries(profile(name).env ?? {})) {
      if (!key.startsWith('EXPO_PUBLIC_')) continue;
      // Si es una URL, se revisa todo menos el host.
      const text = /^https?:\/\//.test(value)
        ? new URL(value).pathname + new URL(value).search
        : value;
      expect(text).not.toMatch(/token|key|secret|password/i);
    }
  }
});
