import {
  ApiError,
  REQUEST_TIMEOUT_MS,
  resolveApiUrl,
  STAGING_API_URL,
  setInvalidTokenHandler,
  setTokenProvider,
  unwrap,
} from '../client';
import { deleteDevice, getHealth, getHomeStatus, registerDevice } from '../generated';

const status = { state: 'con_luz', since: 1793628000000, alias: 'Casa', openOutageStart: null };

function json(body: unknown, statusCode = 200): Response {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'content-type': 'application/json' },
  });
}

function mockFetch(impl: (request: Request, init?: RequestInit) => Promise<Response>) {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input, init) => impl(input as Request, init));
}

function sentRequest(spy: jest.SpyInstance): Request {
  return spy.mock.calls[0][0] as Request;
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  setTokenProvider(async () => null);
  setInvalidTokenHandler(null);
});

it('resolveApiUrl usa la variable y quita la barra final', () => {
  expect(resolveApiUrl('http://localhost:8787/')).toBe('http://localhost:8787');
  expect(resolveApiUrl(undefined)).toBe(STAGING_API_URL);
});

it('manda Authorization: Bearer en rutas con token', async () => {
  setTokenProvider(async () => 'abc.def');
  const spy = mockFetch(async () => json(status));
  await unwrap(getHomeStatus());
  expect(sentRequest(spy).headers.get('authorization')).toBe('Bearer abc.def');
});

it('sin token no manda Authorization', async () => {
  setTokenProvider(async () => null);
  const spy = mockFetch(async () => json(status));
  await unwrap(getHomeStatus());
  expect(sentRequest(spy).headers.get('authorization')).toBeNull();
});

it('getHealth no manda el token', async () => {
  setTokenProvider(async () => 'abc.def');
  const spy = mockFetch(async () => json({ ok: true }));
  const data = await unwrap(getHealth());
  expect(sentRequest(spy).headers.get('authorization')).toBeNull();
  expect(data).toEqual({ ok: true });
});

it('corta la petición a los 15 s', async () => {
  jest.useFakeTimers();
  mockFetch(
    (_request, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  );
  const result = unwrap(getHealth()).catch((e: unknown) => e);
  await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
  const error = await result;
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ code: 'timeout', status: null });
});

it('un 401 se convierte en invalid_token', async () => {
  mockFetch(async () => json({ error: { code: 'invalid_token', message: 'x' } }, 401));
  await expect(unwrap(getHomeStatus())).rejects.toMatchObject({
    code: 'invalid_token',
    status: 401,
  });
});

it('un código de error desconocido da unknown con su status', async () => {
  mockFetch(async () => json({ error: { code: 'nuevo', message: 'x' } }, 418));
  const error = await unwrap(getHomeStatus()).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ code: 'unknown', status: 418 });
});

it('una respuesta fuera de contrato da invalid_response', async () => {
  mockFetch(async () => json({ state: 'nuevo', since: 1, alias: 'x', openOutageStart: null }));
  const error = await unwrap(getHomeStatus()).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ code: 'invalid_response' });
});

it('sin red da network', async () => {
  mockFetch(async () => {
    throw new TypeError('Network request failed');
  });
  const error = await unwrap(getHealth()).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ code: 'network', status: null });
});

it('si el proveedor del token falla, no manda la petición', async () => {
  setTokenProvider(async () => {
    throw new Error('vault');
  });
  const spy = mockFetch(async () => json(status));
  const error = await unwrap(getHomeStatus()).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(spy).not.toHaveBeenCalled();
});

it('el mensaje de ApiError no incluye el token', async () => {
  setTokenProvider(async () => 'abc.def');
  mockFetch(async () => json({ error: { code: 'invalid_token', message: 'x' } }, 401));
  const error = (await unwrap(getHomeStatus()).catch((e: unknown) => e)) as ApiError;
  expect(error).toBeInstanceOf(ApiError);
  expect(error.message).not.toContain('abc.def');
});

describe('token inválido', () => {
  const invalidToken = () => json({ error: { code: 'invalid_token', message: 'x' } }, 401);

  it('un 401 invalid_token en una llamada con token avisa con el token que se mandó', async () => {
    const onInvalid = jest.fn();
    setInvalidTokenHandler(onInvalid);
    setTokenProvider(async () => 'abc.def');
    mockFetch(async () => invalidToken());
    await expect(unwrap(getHomeStatus())).rejects.toMatchObject({
      code: 'invalid_token',
      status: 401,
    });
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(onInvalid).toHaveBeenCalledWith('abc.def');
  });

  it('un 500 no marca el token', async () => {
    const onInvalid = jest.fn();
    setInvalidTokenHandler(onInvalid);
    setTokenProvider(async () => 'abc.def');
    mockFetch(async () => json({ error: { code: 'internal_error', message: 'x' } }, 500));
    await expect(unwrap(getHomeStatus())).rejects.toMatchObject({ code: 'internal_error' });
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('un 401 con otro código no marca el token', async () => {
    const onInvalid = jest.fn();
    setInvalidTokenHandler(onInvalid);
    setTokenProvider(async () => 'abc.def');
    mockFetch(async () => json({ error: { code: 'validation_failed', message: 'x' } }, 401));
    await expect(unwrap(getHomeStatus())).rejects.toMatchObject({ code: 'validation_failed' });
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('una llamada sin Authorization no marca nada, aunque el servidor conteste invalid_token', async () => {
    const onInvalid = jest.fn();
    setInvalidTokenHandler(onInvalid);
    setTokenProvider(async () => null);
    mockFetch(async () => invalidToken());
    await expect(unwrap(getHomeStatus())).rejects.toMatchObject({ code: 'invalid_token' });
    await expect(unwrap(registerDevice({ body: { appVersion: '0.1.0' } }))).rejects.toMatchObject({
      code: 'invalid_token',
    });
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('con handleInvalidToken: false (deleteDevice) no avisa', async () => {
    const onInvalid = jest.fn();
    setInvalidTokenHandler(onInvalid);
    setTokenProvider(async () => 'abc.def');
    mockFetch(async () => invalidToken());
    await expect(unwrap(deleteDevice(), { handleInvalidToken: false })).rejects.toMatchObject({
      code: 'invalid_token',
    });
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('si el aviso falla, el error original sigue siendo el que se lanza', async () => {
    setInvalidTokenHandler(async () => {
      throw new Error('el nativo falló');
    });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    setTokenProvider(async () => 'abc.def');
    mockFetch(async () => invalidToken());
    await expect(unwrap(getHomeStatus())).rejects.toMatchObject({ code: 'invalid_token' });
  });
});
