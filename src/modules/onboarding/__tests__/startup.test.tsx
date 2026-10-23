import { render, screen } from '@testing-library/react-native';
import RootLayout from '../../../../app/_layout';
import * as native from '../../power-detection/power-monitor';
import { resolveStartup } from '../startup';

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
jest.mock('../../power-detection/power-monitor', () => ({
  getToken: jest.fn(),
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

  it('si el nativo falla, manda al onboarding en vez de seguir a ciegas', async () => {
    mocked.getToken.mockRejectedValue(new Error('boom'));
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
    expect(screen.queryByText('screen:index')).toBeNull();
    expect(mocked.arm).not.toHaveBeenCalled();
    expect(mocked.recordAppOpen).not.toHaveBeenCalled();
  });

  it('vigilando, abre la app y arma la detección', async () => {
    state('tok', false, 'watch');
    await render(<RootLayout />);
    expect(await screen.findByText('screen:index')).toBeOnTheScreen();
    expect(screen.queryByText('screen:onboarding/index')).toBeNull();
    await screen.findByText('screen:index');
    expect(mocked.configureApi).toHaveBeenCalled();
    expect(mocked.arm).toHaveBeenCalledTimes(1);
    expect(mocked.recordAppOpen).toHaveBeenCalledTimes(1);
  });

  it('si la app murió en la guía de batería, no arma ni abre la app: sigue en el onboarding', async () => {
    state('tok', false, 'watch', 'battery');
    await render(<RootLayout />);
    expect(await screen.findByText('screen:onboarding/index')).toBeOnTheScreen();
    expect(screen.queryByText('screen:index')).toBeNull();
  });

  it('Solo seguir no arma la detección ni registra el arranque', async () => {
    state('tok', false, 'follow');
    await render(<RootLayout />);
    expect(await screen.findByText('screen:index')).toBeOnTheScreen();
    expect(mocked.configureApi).toHaveBeenCalled();
    expect(mocked.arm).not.toHaveBeenCalled();
    expect(mocked.recordAppOpen).not.toHaveBeenCalled();
  });
});
