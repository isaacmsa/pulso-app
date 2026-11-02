import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PermissionsAndroid, Platform } from 'react-native';
import Battery from '../../../../app/onboarding/battery';
import HomeNetwork from '../../../../app/onboarding/home';
import RoleScreen from '../../../../app/onboarding/index';
import Notifications from '../../../../app/onboarding/notifications';
import { ApiError } from '../../../shared/api/client';
import * as native from '../../power-detection/power-monitor';
import * as progress from '../progress';
import { register } from '../register';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => ({ role: mockRole }),
}));
let mockRole: string | undefined;

jest.mock('../register', () => ({ register: jest.fn() }));
jest.mock('../../power-detection/power-monitor', () => ({
  readDiagnostics: jest.fn(),
  openBatterySettings: jest.fn(),
  learnHomeNetwork: jest.fn(),
  getOnboardingStep: jest.fn(),
  getRole: jest.fn(),
}));
jest.mock('../progress', () => ({
  advanceOnboarding: jest.fn(),
  finishOnboarding: jest.fn(),
}));

const registerMock = register as jest.Mock;
const mocked = native as jest.Mocked<typeof native>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = undefined;
  mocked.getOnboardingStep.mockResolvedValue(null);
  mocked.getRole.mockResolvedValue('watch');
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

  it('Solo seguir explica que después se escribe el código de la casa', async () => {
    await render(<RoleScreen />);
    expect(
      await screen.findByText(
        'Después escribes el código que te mandaron y ves esa casa en Familia.',
      ),
    ).toBeOnTheScreen();
  });

  it('si la app murió en la guía de batería, al volver retoma la guía y no registra de nuevo', async () => {
    mocked.getOnboardingStep.mockResolvedValue('battery');
    await render(<RoleScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/battery'));
    expect(registerMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Vigilar mi casa')).toBeNull();
  });

  it('retoma en la red de casa si ahí se quedó', async () => {
    mocked.getOnboardingStep.mockResolvedValue('home');
    await render(<RoleScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/home'));
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('retoma en las notificaciones con el rol guardado', async () => {
    mocked.getOnboardingStep.mockResolvedValue('notifications');
    mocked.getRole.mockResolvedValue('follow');
    await render(<RoleScreen />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/onboarding/notifications',
        params: { role: 'follow' },
      }),
    );
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('si el paso pendiente es el rol (o no hay), muestra la pregunta', async () => {
    mocked.getOnboardingStep.mockResolvedValue('role');
    await render(<RoleScreen />);
    expect(await screen.findByText('Vigilar mi casa')).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
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

  // Esta versión no trae push ni seguir casas: el permiso lo usan D (si se activa) y los avisos que vienen después.
  it('dice para qué sirve el permiso en esta versión, sin prometer avisos de casas seguidas', async () => {
    mockRole = 'watch';
    await render(<Notifications />);
    expect(
      screen.getByText(
        'Este permiso lo usa el servicio en primer plano, si lo activas en Ajustes. Los avisos de cuando se va y vuelve la luz llegan en la próxima actualización.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/la casa que sigues/)).toBeNull();
  });

  it('en Android 13 pide el permiso y sigue a la batería si vigila', async () => {
    const restore = withAndroid(34);
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');
    mockRole = 'watch';
    try {
      await render(<Notifications />);
      await fireEvent.press(screen.getByText('Permitir notificaciones'));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/onboarding/battery'));
      expect(progress.advanceOnboarding).toHaveBeenCalledWith('battery');
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
      await waitFor(() => expect(progress.finishOnboarding).toHaveBeenCalledTimes(1));
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

  it('el onboarding de vigilar muestra la opción UPS', async () => {
    mocked.readDiagnostics.mockResolvedValue({ manufacturer: 'samsung' } as never);
    await render(<Battery />);
    expect(await screen.findByLabelText('Mi router tiene UPS')).toBeOnTheScreen();
    expect(screen.getByText(/Experimental/)).toBeOnTheScreen();
  });

  it('Listo sigue a la red de casa', async () => {
    mocked.readDiagnostics.mockResolvedValue({ manufacturer: 'samsung' } as never);
    await render(<Battery />);
    await fireEvent.press(await screen.findByText('Listo, ya lo hice'));
    expect(progress.advanceOnboarding).toHaveBeenCalledWith('home');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/home');
  });
});

describe('Wi-Fi de casa', () => {
  it('aprende la red y termina el onboarding', async () => {
    mocked.learnHomeNetwork.mockResolvedValue(true);
    await render(<HomeNetwork />);
    await fireEvent.press(screen.getByText('Ya estoy conectado'));
    await waitFor(() => expect(progress.finishOnboarding).toHaveBeenCalledTimes(1));
  });

  it('si no hay Wi-Fi, avisa y no termina', async () => {
    mocked.learnHomeNetwork.mockResolvedValue(false);
    await render(<HomeNetwork />);
    await fireEvent.press(screen.getByText('Ya estoy conectado'));
    expect(
      await screen.findByText(/Conéctate al Wi-Fi de tu casa y toca de nuevo/),
    ).toBeOnTheScreen();
    expect(progress.finishOnboarding).not.toHaveBeenCalled();
  });

  it('Lo hago después termina sin aprender la red', async () => {
    await render(<HomeNetwork />);
    await fireEvent.press(screen.getByText('Lo hago después'));
    expect(mocked.learnHomeNetwork).not.toHaveBeenCalled();
    expect(progress.finishOnboarding).toHaveBeenCalledTimes(1);
  });
});
