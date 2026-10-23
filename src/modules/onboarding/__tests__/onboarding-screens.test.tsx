import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PermissionsAndroid, Platform } from 'react-native';
import Battery from '../../../../app/onboarding/battery';
import HomeNetwork from '../../../../app/onboarding/home';
import RoleScreen from '../../../../app/onboarding/index';
import Notifications from '../../../../app/onboarding/notifications';
import { ApiError } from '../../../shared/api/client';
import * as native from '../../power-detection/power-monitor';
import { register } from '../register';
import * as startup from '../startup';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ role: mockRole }),
}));
let mockRole: string | undefined;

jest.mock('../register', () => ({ register: jest.fn() }));
jest.mock('../../power-detection/power-monitor', () => ({
  readDiagnostics: jest.fn(),
  openBatterySettings: jest.fn(),
  learnHomeNetwork: jest.fn(),
}));
jest.mock('../startup', () => ({ notifyStartupChanged: jest.fn() }));

const registerMock = register as jest.Mock;
const mocked = native as jest.Mocked<typeof native>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = undefined;
});

describe('¿Este teléfono se queda en casa?', () => {
  it('Vigilar mi casa registra como watch y sigue a las notificaciones', async () => {
    registerMock.mockResolvedValue(undefined);
    await render(<RoleScreen />);
    await fireEvent.press(screen.getByText('Vigilar mi casa'));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/onboarding/notifications',
        params: { role: 'watch' },
      }),
    );
    expect(registerMock).toHaveBeenCalledWith('watch');
  });

  it('Solo seguir una casa registra como follow', async () => {
    registerMock.mockResolvedValue(undefined);
    await render(<RoleScreen />);
    await fireEvent.press(screen.getByText('Solo seguir una casa'));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/onboarding/notifications',
        params: { role: 'follow' },
      }),
    );
    expect(registerMock).toHaveBeenCalledWith('follow');
  });

  it('si el registro falla sin red, muestra el error y permite reintentar', async () => {
    registerMock.mockRejectedValueOnce(new ApiError('network'));
    registerMock.mockResolvedValueOnce(undefined);
    await render(<RoleScreen />);
    await fireEvent.press(screen.getByText('Vigilar mi casa'));
    expect(await screen.findByText(/Sin conexión/)).toBeOnTheScreen();
    expect(mockPush).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Vigilar mi casa'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
    expect(registerMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
  });
});

describe('permiso de notificaciones', () => {
  function withAndroid(version: number) {
    const original = Platform.Version;
    Object.defineProperty(Platform, 'Version', { value: version, configurable: true });
    return () =>
      Object.defineProperty(Platform, 'Version', { value: original, configurable: true });
  }

  it('en Android 13 pide el permiso y sigue a la batería si vigila', async () => {
    const restore = withAndroid(34);
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');
    mockRole = 'watch';
    try {
      await render(<Notifications />);
      await fireEvent.press(screen.getByText('Permitir notificaciones'));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/onboarding/battery'));
      expect(request).toHaveBeenCalledWith('android.permission.POST_NOTIFICATIONS');
    } finally {
      restore();
      request.mockRestore();
    }
  });

  it('negar el permiso no bloquea el onboarding', async () => {
    const restore = withAndroid(34);
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');
    mockRole = 'watch';
    try {
      await render(<Notifications />);
      await fireEvent.press(screen.getByText('Permitir notificaciones'));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/onboarding/battery'));
    } finally {
      restore();
      request.mockRestore();
    }
  });

  it('Solo seguir salta la batería y la red de casa y termina el onboarding', async () => {
    const restore = withAndroid(31);
    const request = jest.spyOn(PermissionsAndroid, 'request');
    mockRole = 'follow';
    try {
      await render(<Notifications />);
      await fireEvent.press(screen.getByText('Permitir notificaciones'));
      await waitFor(() => expect(startup.notifyStartupChanged).toHaveBeenCalledTimes(1));
      expect(request).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      restore();
      request.mockRestore();
    }
  });
});

describe('guía de batería', () => {
  it('muestra los pasos del fabricante y abre su pantalla', async () => {
    mocked.readDiagnostics.mockResolvedValue({ manufacturer: 'Xiaomi' } as never);
    mocked.openBatterySettings.mockResolvedValue(true);
    await render(<Battery />);
    expect(await screen.findByText('Inicio automático')).toBeOnTheScreen();
    await fireEvent.press((await screen.findAllByText('Abrir ajustes'))[0] as never);
    expect(mocked.openBatterySettings).toHaveBeenCalledWith('autostart');
  });

  it('si no se pudo abrir ninguna pantalla, lo dice', async () => {
    mocked.readDiagnostics.mockResolvedValue({ manufacturer: 'Xiaomi' } as never);
    mocked.openBatterySettings.mockResolvedValue(false);
    await render(<Battery />);
    await fireEvent.press((await screen.findAllByText('Abrir ajustes'))[0] as never);
    expect(await screen.findByText(/Ábrelo a mano/)).toBeOnTheScreen();
  });

  it('Listo sigue a la red de casa', async () => {
    mocked.readDiagnostics.mockResolvedValue({ manufacturer: 'samsung' } as never);
    await render(<Battery />);
    await fireEvent.press(await screen.findByText('Listo, ya lo hice'));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/home');
  });
});

describe('Wi-Fi de casa', () => {
  it('aprende la red y termina el onboarding', async () => {
    mocked.learnHomeNetwork.mockResolvedValue(true);
    await render(<HomeNetwork />);
    await fireEvent.press(screen.getByText('Ya estoy conectado'));
    await waitFor(() => expect(startup.notifyStartupChanged).toHaveBeenCalledTimes(1));
  });

  it('si no hay Wi-Fi, avisa y no termina', async () => {
    mocked.learnHomeNetwork.mockResolvedValue(false);
    await render(<HomeNetwork />);
    await fireEvent.press(screen.getByText('Ya estoy conectado'));
    expect(
      await screen.findByText(/Conéctate al Wi-Fi de tu casa y toca de nuevo/),
    ).toBeOnTheScreen();
    expect(startup.notifyStartupChanged).not.toHaveBeenCalled();
  });

  it('Lo hago después termina sin aprender la red', async () => {
    await render(<HomeNetwork />);
    await fireEvent.press(screen.getByText('Lo hago después'));
    expect(mocked.learnHomeNetwork).not.toHaveBeenCalled();
    expect(startup.notifyStartupChanged).toHaveBeenCalledTimes(1);
  });
});
