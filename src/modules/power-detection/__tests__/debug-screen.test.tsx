import { fireEvent, render, screen } from '@testing-library/react-native';
import { PermissionsAndroid, Platform } from 'react-native';
import DebugScreen from '../../../../app/debug';
import PowerMonitor from '../../../../modules/power-monitor';
import { getHealth } from '../../../shared/api/generated/sdk.gen';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});
jest.mock('../../../../modules/power-monitor', () => ({
  __esModule: true,
  default: {
    getEvents: jest.fn().mockResolvedValue('[]'),
    getDiagnostics: jest.fn().mockResolvedValue('{}'),
    recordReport: jest.fn().mockResolvedValue('{}'),
    recordSnapshot: jest.fn(),
    setForegroundServiceEnabled: jest.fn().mockResolvedValue(undefined),
    isForegroundServiceEnabled: jest.fn().mockResolvedValue(false),
    learnHomeNetwork: jest.fn(),
    exportEvents: jest.fn(),
  },
}));
jest.mock('../../../shared/api/generated/sdk.gen', () => ({ getHealth: jest.fn() }));
const native = PowerMonitor as jest.Mocked<typeof PowerMonitor>;
const health = getHealth as unknown as jest.Mock;

beforeEach(() => {
  health.mockReset();
  health.mockResolvedValue({ data: { ok: true }, response: new Response(null, { status: 200 }) });
});

it.each([
  ['Se fue la luz ahora', 'sin_luz'],
  ['Volvió', 'hay_luz'],
  ['Fluctuando', 'fluctuando'],
])('el botón "%s" guarda un reporte %s', async (label, value) => {
  await render(<DebugScreen />);
  await fireEvent.press(screen.getByText(label));
  expect(native.recordReport).toHaveBeenCalledWith(value);
});

it('en Android 12 o menos activa D sin pedir el permiso de notificaciones', async () => {
  const original = Platform.Version;
  Object.defineProperty(Platform, 'Version', { value: 31, configurable: true });
  const request = jest.spyOn(PermissionsAndroid, 'request');
  try {
    await render(<DebugScreen />);
    await fireEvent(screen.getByRole('switch'), 'valueChange', true);
    expect(request).not.toHaveBeenCalled();
    expect(native.setForegroundServiceEnabled).toHaveBeenCalledWith(true);
  } finally {
    Object.defineProperty(Platform, 'Version', { value: original, configurable: true });
    request.mockRestore();
  }
});

it('muestra "API: en línea" cuando /health responde', async () => {
  await render(<DebugScreen />);
  expect(await screen.findByText('API: en línea')).toBeOnTheScreen();
});

it('muestra "API: sin respuesta (network)" cuando falla, y la lista sigue visible', async () => {
  health.mockResolvedValue({ error: new TypeError('Network request failed') });
  await render(<DebugScreen />);
  expect(await screen.findByText('API: sin respuesta (network)')).toBeOnTheScreen();
  expect(screen.getByText('Todavía no hay eventos.')).toBeOnTheScreen();
});
