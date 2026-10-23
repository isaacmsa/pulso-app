import type { CreateClientConfig } from './generated/client.gen';

export const STAGING_API_URL = 'https://pulso-api-staging.isaac-mendozasa.workers.dev';

export function resolveApiUrl(value: string | undefined): string {
  const url = value?.trim().replace(/\/+$/, '');
  return url ? url : STAGING_API_URL;
}

// Expo solo reemplaza la variable si se escribe literal: process.env.EXPO_PUBLIC_API_URL.
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: resolveApiUrl(process.env.EXPO_PUBLIC_API_URL),
});
