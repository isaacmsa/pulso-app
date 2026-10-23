import { ZodError } from 'zod';

import type { CreateClientConfig } from './generated/client.gen';
import { zError } from './generated/zod.gen';

export const STAGING_API_URL = 'https://pulso-api-staging.isaac-mendozasa.workers.dev';
export const REQUEST_TIMEOUT_MS = 15_000;

export function resolveApiUrl(value: string | undefined): string {
  const url = value?.trim().replace(/\/+$/, '');
  return url ? url : STAGING_API_URL;
}

export type ApiErrorCode =
  | 'validation_failed'
  | 'invalid_token'
  | 'not_found'
  | 'home_exists'
  | 'rate_limited'
  | 'internal_error'
  | 'timeout'
  | 'network'
  | 'invalid_response'
  | 'unknown';

// El mensaje solo lleva el código y el estado: nunca headers ni cuerpos (el token no puede filtrarse).
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;

  constructor(code: ApiErrorCode, status: number | null = null) {
    super(status === null ? `API error: ${code}` : `API error: ${code} (${status})`);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

let tokenProvider: () => Promise<string | null> = async () => null;

export function setTokenProvider(provider: () => Promise<string | null>): void {
  tokenProvider = provider;
}

function createTimeoutError(): Error {
  const error = new Error('Request timed out');
  error.name = 'TimeoutError';
  return error;
}

// Busca globalThis.fetch en cada petición para que las pruebas puedan espiarlo.
async function fetchWithTimeout(input: RequestInfo | URL): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input);
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort();
  if (request.signal.aborted) controller.abort();
  else request.signal.addEventListener('abort', onCallerAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    return await globalThis.fetch(request, { signal: controller.signal });
  } catch (error) {
    if (timedOut) throw createTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', onCallerAbort);
  }
}

// Expo solo reemplaza la variable si se escribe literal: process.env.EXPO_PUBLIC_API_URL.
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: resolveApiUrl(process.env.EXPO_PUBLIC_API_URL),
  auth: async () => (await tokenProvider()) ?? undefined,
  fetch: fetchWithTimeout,
});

function classify(error: unknown, response: Response | undefined): ApiError {
  if (response && !response.ok) {
    const parsed = zError.safeParse(error);
    return new ApiError(parsed.success ? parsed.data.error.code : 'unknown', response.status);
  }
  if (error instanceof ZodError) return new ApiError('invalid_response');
  if (error instanceof Error && error.name === 'TimeoutError') return new ApiError('timeout');
  if (error instanceof TypeError) return new ApiError('network');
  return new ApiError('unknown');
}

// El cliente generado no lanza: devuelve { error, response }. Aquí se convierte en ApiError.
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response?: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response?: Response };
  try {
    result = await call;
  } catch (error) {
    throw classify(error, undefined);
  }
  const { data, error, response } = result;
  if (error === undefined && response?.ok !== false) return data as T;
  throw classify(error, response);
}
