import { fireEvent, render, screen } from '@testing-library/react-native';
import DebugScreen from '../../../../app/debug';
import PowerMonitor from '../../../../modules/power-monitor';

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
    setForegroundServiceEnabled: jest.fn(),
    learnHomeNetwork: jest.fn(),
    exportEvents: jest.fn(),
  },
}));
const native = PowerMonitor as jest.Mocked<typeof PowerMonitor>;

it.each([
  ['Se fue la luz ahora', 'sin_luz'],
  ['Volvió', 'hay_luz'],
  ['Fluctuando', 'fluctuando'],
])('el botón "%s" guarda un reporte %s', async (label, value) => {
  await render(<DebugScreen />);
  await fireEvent.press(screen.getByText(label));
  expect(native.recordReport).toHaveBeenCalledWith(value);
});
