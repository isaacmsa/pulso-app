import { act, render, screen } from '@testing-library/react-native';
import RootLayout from '../../../../app/_layout';
import { ApiError, unwrap } from '../../../shared/api/client';
import { getHomeStatus } from '../../../shared/api/generated';
import { registerPushToken, startPushTokenSync } from '../../notifications/push-token';
import * as native from '../../power-detection/power-monitor';
import { RETRY_TRANSIENT_MS, resolveStartup } from '../startup';

jest.mock('expo-router', () => {
  const { Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
  const React = jest.requireActual<typeof import('react')>('react');
  const Screen = ({ name }: { name: string }) => <T>{`screen:${name}`}</T>;
  const Protected = ({ guard, children }: { guard: boolean; children: React.ReactNode }) =>
    guard && <>{children}</>;
  const Stack = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  Stack.Screen = Screen;
  Stack.Protected = Protected;
  return { Stack };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('../../notifications/push-token', () => ({
  registerPushToken: jest.fn(),
  startPushTokenSync: jest.fn(() => () => undefined),
}));
jest.mock('../../power-detection/power-monitor', () => ({
  getToken: jest.fn(),
  getTokenState: jest.fn(),
  markTokenInvalid: jest.fn(),
  isTokenInvalid: jest.fn(),
  getRole: jest.fn(),
  getOnboardingStep: jest.fn(),
  configureApi: jest.fn(),
  arm: jest.fn(),
  recordAppOpen: jest.fn(),
}));

const mocked = native as jest.Mocked<typeof native>;

beforeEach(() => {
  jest.resetAllMocks();
  mocked.configureApi.mockResolvedValue(undefined);
  mocked.arm.mockResolvedValue(undefined);
  mocked.recordAppOpen.mockResolvedValue({} as never);
});

function state(
  token: string | null,
  invalid: boolean,
  role: 'watch' | 'follow' | null,
  step: 'role' | 'notifications' | 'battery' | 'home' | null = null,
) {
  mocked.getOnboardingStep.mockResolvedValue(step);
  mocked.getToken.mockResolvedValue(token);
  mocked.getTokenState.mockResolvedValue(token ? 'present' : 'absent');
  mocked.isTokenInvalid.mockResolvedValue(invalid);
  mocked.getRole.mockResolvedValue(role);
}

describe('resolveStartup', () => {
  it.each([
    ['sin token (registrador de la fase 0)', null, false, null, 'onboarding', null],
    ['con el token inválido', 'tok', true, 'watch', 'onboarding', null],
    ['con token pero sin rol (registro a medias)', 'tok', false, null, 'onboarding', null],
    ['vigilando', 'tok', false, 'watch', 'watch', null],
    ['siguiendo', 'tok', false, 'follow', 'follow', null],
    ['la app murió en la guía de batería', 'tok', false, 'watch', 'onboarding', 'battery'],
    [
      'la app murió en notificaciones de un seguidor',
      'tok',
      false,
      'follow',
      'onboarding',
      'notifications',
    ],
  ] as const)('%s -> %s', async (_label, token, invalid, role, expected, step) => {
    state(token, invalid, role, step);
    await expect(resolveStartup()).resolves.toBe(expected);
  });

  it('con la clave ilegible, manda al onboarding a registrar de nuevo', async () => {
    state('tok', false, 'watch');
    mocked.getTokenState.mockResolvedValue('unreadable');
    await expect(resolveStartup()).resolves.toBe('onboarding');
  });

  it.each([
    ['watch', 'watch'],
    ['follow', 'follow'],
    [null, 'follow'],
  ] as const)(
    'con falla transitoria no manda al onboarding (rol %s -> %s)',
    async (role, expected) => {
      state('tok', false, role);
      mocked.getTokenState.mockResolvedValue('transient');
      await expect(resolveStartup()).resolves.toBe(expected);
    },
  );

  it('si el nativo falla, manda al onboarding en vez de seguir a ciegas', async () => {
    mocked.getTokenState.mockRejectedValue(new Error('boom'));
    mocked.isTokenInvalid.mockResolvedValue(false);
    mocked.getRole.mockResolvedValue('watch');
    mocked.getOnboardingStep.mockResolvedValue(null);
    await expect(resolveStartup()).resolves.toBe('onboarding');
  });
});

describe('RootLayout', () => {
  it('con el token inválido, la app abre el onboarding', async () => {
    state('tok', true, 'watch');
    await render(<RootLayout />);
    expect(await screen.findByText('screen:onboarding/index')).toBeOnTheScreen();
    expect(screen.queryByText('screen:(tabs)')).toBeNull();
    expect(mocked.arm).not.toHaveBeenCalled();
    expect(mocked.recordAppOpen).not.toHaveBeenCalled();
  });

  it('vigilando, abre la app y arma la detección', async () => {
    state('tok', false, 'watch');
    await render(<RootLayout />);
    expect(await screen.findByText('screen:(tabs)')).toBeOnTheScreen();
    expect(screen.queryByText('screen:onboarding/index')).toBeNull();
    await screen.findByText('screen:(tabs)');
    expect(mocked.configureApi).toHaveBeenCalled();
    expect(mocked.arm).toHaveBeenCalledTimes(1);
    expect(mocked.recordAppOpen).toHaveBeenCalledTimes(1);
  });

  it('si la app murió en la guía de batería, no arma ni abre la app: sigue en el onboarding', async () => {
    state('tok', false, 'watch', 'battery');
    await render(<RootLayout />);
    expect(await screen.findByText('screen:onboarding/index')).toBeOnTheScreen();
    expect(screen.queryByText('screen:(tabs)')).toBeNull();
  });

  it('Solo seguir no arma la detección ni registra el arranque', async () => {
    state('tok', false, 'follow');
    await render(<RootLayout />);
    expect(await screen.findByText('screen:(tabs)')).toBeOnTheScreen();
    expect(mocked.configureApi).toHaveBeenCalled();
    expect(mocked.arm).not.toHaveBeenCalled();
    expect(mocked.recordAppOpen).not.toHaveBeenCalled();
  });

  it('con falla transitoria, abre la app sin armar de nuevo ni registrar, y reintenta más tarde', async () => {
    jest.useFakeTimers();
    try {
      state('tok', false, 'follow');
      mocked.getTokenState.mockResolvedValue('transient');
      await render(<RootLayout />);
      expect(await screen.findByText('screen:(tabs)')).toBeOnTheScreen();
      expect(screen.queryByText('screen:onboarding/index')).toBeNull();

      // El Keystore sigue sin ayudar: no pasa nada. Cuando por fin dice que no hay nada, vuelve a decidir.
      mocked.getTokenState.mockResolvedValue('absent');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(RETRY_TRANSIENT_MS);
      });
      expect(await screen.findByText('screen:onboarding/index')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  describe('token rechazado por el servidor', () => {
    const fetchSpy = () => jest.spyOn(globalThis, 'fetch');
    afterEach(() => jest.restoreAllMocks());

    it('un 401 invalid_token en una pantalla vuelve al onboarding', async () => {
      state('tok', false, 'follow');
      mocked.markTokenInvalid.mockImplementation(async () => {
        mocked.isTokenInvalid.mockResolvedValue(true);
      });
      fetchSpy().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'invalid_token', message: 'x' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      );
      await render(<RootLayout />);
      expect(await screen.findByText('screen:(tabs)')).toBeOnTheScreen();

      // Una pantalla pide algo con el token y el servidor ya no lo reconoce.
      await act(async () => {
        await expect(unwrap(getHomeStatus())).rejects.toBeInstanceOf(ApiError);
      });
      expect(mocked.markTokenInvalid).toHaveBeenCalledWith('tok');
      expect(await screen.findByText('screen:onboarding/index')).toBeOnTheScreen();
      expect(screen.queryByText('screen:(tabs)')).toBeNull();
    });

    it('un 500 no marca el token ni saca de la app', async () => {
      state('tok', false, 'follow');
      fetchSpy().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'internal_error', message: 'x' } }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      );
      await render(<RootLayout />);
      expect(await screen.findByText('screen:(tabs)')).toBeOnTheScreen();
      await act(async () => {
        await expect(unwrap(getHomeStatus())).rejects.toBeInstanceOf(ApiError);
      });
      expect(mocked.markTokenInvalid).not.toHaveBeenCalled();
      expect(screen.getByText('screen:(tabs)')).toBeOnTheScreen();
    });
  });

  describe('push token', () => {
    it('al abrir la app (vigilando o siguiendo) registra el push token y escucha sus cambios', async () => {
      state('tok', false, 'follow');
      await render(<RootLayout />);
      expect(await screen.findByText('screen:(tabs)')).toBeOnTheScreen();
      expect(registerPushToken).toHaveBeenCalled();
      expect(startPushTokenSync).toHaveBeenCalledTimes(1);
    });

    it('en el onboarding todavía no lo registra', async () => {
      state('tok', true, 'watch');
      await render(<RootLayout />);
      expect(await screen.findByText('screen:onboarding/index')).toBeOnTheScreen();
      expect(registerPushToken).not.toHaveBeenCalled();
    });
  });
});
