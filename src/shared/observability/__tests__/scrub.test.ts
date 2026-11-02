import { scrubBreadcrumb, scrubEvent, scrubString } from '../scrub';

const b64 = (n: number) => 'aB3_-'.repeat(Math.ceil(n / 5)).slice(0, n);
const TOKEN = `${b64(43)}.${b64(43)}`;
const PUSH = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

describe('scrub', () => {
  it('beforeSend borra Authorization y token de la petición y de los breadcrumbs', () => {
    const event = scrubEvent({
      request: {
        url: 'https://api.test/v1/me',
        headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
        data: { token: 'abc', pushToken: 'def', deviceId: 'dev-1', keep: 'ok' },
      },
      extra: { deviceId: 'dev-1', nested: { token: 'zzz' }, keep: 1 },
      contexts: { app: { pushToken: 'p' } },
      breadcrumbs: [
        {
          category: 'xhr',
          data: { url: '/v1/me', headers: { authorization: `Bearer ${TOKEN}` }, token: 't' },
        },
      ],
    });
    expect(JSON.stringify(event)).not.toContain(TOKEN);
    expect(event.request?.headers?.Authorization).toBe('[borrado]');
    expect(event.request?.headers?.Accept).toBe('application/json');
    expect(event.request?.data).toEqual({
      token: '[borrado]',
      pushToken: '[borrado]',
      deviceId: '[borrado]',
      keep: 'ok',
    });
    expect(event.extra).toEqual({ deviceId: '[borrado]', nested: { token: '[borrado]' }, keep: 1 });
    expect(event.contexts?.app).toEqual({ pushToken: '[borrado]' });
    const data = event.breadcrumbs?.[0]?.data as Record<string, unknown>;
    expect(data.token).toBe('[borrado]');
    expect(data.headers).toEqual({ authorization: '[borrado]' });
    expect(data.url).toBe('/v1/me');
  });

  it('borra un token con forma de token en un mensaje', () => {
    const event = scrubEvent({ message: `falló con ${TOKEN} al subir` });
    expect(event.message).toBe('falló con [token] al subir');
    expect(scrubBreadcrumb({ message: `x ${TOKEN}` }).message).toBe('x [token]');
  });

  it('borra el ExponentPushToken', () => {
    expect(scrubString(`push ${PUSH} listo`)).toBe('push [push-token] listo');
    const event = scrubEvent({ exception: { values: [{ type: 'Error', value: PUSH }] } });
    expect(event.exception?.values?.[0]?.value).toBe('[push-token]');
  });

  it('borra el código de casa de una URL /c/', () => {
    expect(scrubString('https://pulso-api.example.dev/c/ABCD2345?x=1')).toBe(
      'https://pulso-api.example.dev/c/[codigo]?x=1',
    );
    const crumb = scrubBreadcrumb({ category: 'navigation', data: { to: '/c/ABCD2345' } });
    expect((crumb.data as { to: string }).to).toBe('/c/[codigo]');
  });
});
