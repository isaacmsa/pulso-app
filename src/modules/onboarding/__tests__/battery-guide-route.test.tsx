import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import RootLayout from '../../../../app/_layout';
import BatteryGuide from '../../../../app/battery-guide';
import { BATTERY_GUIDE_ROUTE } from '../../home/detection-risk';
import * as native from '../../power-detection/power-monitor';

const mockBack = jest.fn();
const mockStartup = jest.fn();
const registered: string[] = [];

jest.mock('expo-router', () => {
  const Stack = ({ children }: { children: ReactNode }) => children;
  Stack.Protected = ({ guard, children }: { guard: boolean; children: ReactNode }) =>
    guard ? children : null;
  Stack.Screen = ({ name }: { name: string }) => {
    registered.push(name);
    return null;
  };
  return { Stack, useRouter: () => ({ back: mockBack, push: jest.fn() }) };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@tanstack/react-query-persist-client', () => ({
  PersistQueryClientProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../../shared/query/client', () => ({ persistOptions: {}, queryClient: {} }));
jest.mock('../../notifications/confirmation', () => ({
  setupNotifications: () => Promise.resolve(),
  startConfirmationResponses: () => () => {},
}));
jest.mock('../../notifications/push-token', () => ({
  registerPushToken: jest.fn(),
  startPushTokenSync: () => () => {},
}));
jest.mock('../startup', () => ({
  installInvalidTokenHandler: jest.fn(),
  useStartup: () => mockStartup(),
}));
jest.mock('../../power-detection/power-monitor', () => ({
  arm: jest.fn().mockResolvedValue(undefined),
  configureApi: jest.fn().mockResolvedValue(undefined),
  getToken: jest.fn(),
  recordAppOpen: jest.fn().mockResolvedValue(undefined),
  readDiagnostics: jest.fn(),
  openBatterySettings: jest.fn(),
}));

beforeEach(() => {
  registered.length = 0;
  jest.clearAllMocks();
  (native.readDiagnostics as jest.Mock).mockResolvedValue({ manufacturer: 'Google' });
});

it('la ruta del aviso está registrada para un teléfono con sesión', async () => {
  mockStartup.mockReturnValue('watch');
  await render(<RootLayout />);
  expect(registered).toContain(BATTERY_GUIDE_ROUTE.slice(1));
  expect(registered).not.toContain('onboarding/battery');
});

it('la guía para teléfonos con sesión se ve y "Listo" solo vuelve', async () => {
  await render(<BatteryGuide />);
  await waitFor(() => expect(native.readDiagnostics).toHaveBeenCalled());
  fireEvent.press(await screen.findByText('Listo, ya lo hice'));
  expect(mockBack).toHaveBeenCalled();
});
