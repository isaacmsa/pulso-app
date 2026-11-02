import * as Sentry from '@sentry/react-native';
import { initSentry } from '../sentry';

const init = jest.mocked(Sentry.init);

describe('initSentry', () => {
  beforeEach(() => init.mockClear());

  it('sin DSN no inicializa Sentry', () => {
    expect(initSentry(undefined)).toBe(false);
    expect(initSentry('')).toBe(false);
    expect(init).not.toHaveBeenCalled();
  });

  it('con DSN inicializa sin PII y con los filtros', () => {
    expect(initSentry('https://k@o0.ingest.sentry.io/1')).toBe(true);
    const options = init.mock.calls[0]?.[0];
    expect(options?.sendDefaultPii).toBe(false);
    expect(typeof options?.beforeSend).toBe('function');
    expect(typeof options?.beforeBreadcrumb).toBe('function');
  });
});
