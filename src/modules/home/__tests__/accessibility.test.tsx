import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import Debug from '../../../../app/debug';
import Battery from '../../../../app/onboarding/battery';
import HomeNetwork from '../../../../app/onboarding/home';
import RoleScreen from '../../../../app/onboarding/index';
import Notifications from '../../../../app/onboarding/notifications';
import { createTestQueryClient } from '../../../shared/query/test-client';
import { BatteryGuideScreen } from '../../onboarding/BatteryGuideScreen';
import * as native from '../../power-detection/power-monitor';
import History from '../screens/HistoryScreen';
import Settings from '../screens/SettingsScreen';
import Status from '../screens/StatusScreen';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({ role: 'watch' }),
  };
});
jest.mock('../../onboarding/progress', () => ({
  advanceOnboarding: jest.fn(),
  finishOnboarding: jest.fn(),
  restartOnboardingAtRole: jest.fn(),
}));
jest.mock('../../onboarding/startup', () => ({ notifyStartupChanged: jest.fn() }));
jest.mock('../../onboarding/register', () => ({ register: jest.fn() }));
jest.mock('../../../shared/query/client', () => ({ clearQueryCache: jest.fn() }));
jest.mock('../../power-detection/foreground-service', () => ({
  requestForegroundService: jest.fn(),
}));
jest.mock('../../power-detection/power-monitor', () => ({
  getRole: jest.fn(),
  getToken: jest.fn(),
  getLastServerStatus: jest.fn(),
  getOnboardingStep: jest.fn(),
  readEvents: jest.fn(),
  readPhoneState: jest.fn(),
  readDiagnostics: jest.fn(),
  recordReport: jest.fn(),
  recordAppOpen: jest.fn(),
  isForegroundServiceEnabled: jest.fn(),
  learnHomeNetwork: jest.fn(),
  exportAndShare: jest.fn(),
  openBatterySettings: jest.fn(),
}));

const mocked = native as jest.Mocked<typeof native>;
const DIAGNOSTICS = {
  appVersion: '1.0.0',
  manufacturer: 'Xiaomi',
  model: 'Redmi',
  sdkInt: 35,
  standbyBucket: 10,
  ignoringBatteryOptimizations: false,
  pendingEvents: 0,
  storedEvents: 0,
  rejectedEvents: 0,
  homeNetworkLearned: true,
  armed: { networkCallback: true, heartbeat: true, chargingJob: true, foregroundService: false },
};

beforeEach(() => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
  mocked.getRole.mockResolvedValue('watch');
  mocked.getLastServerStatus.mockResolvedValue(null);
  mocked.getOnboardingStep.mockResolvedValue(null);
  mocked.readEvents.mockResolvedValue({ events: [], invalid: 0 });
  mocked.readPhoneState.mockResolvedValue(null);
  mocked.readDiagnostics.mockResolvedValue(DIAGNOSTICS);
  mocked.isForegroundServiceEnabled.mockResolvedValue(false);
});

afterEach(() => jest.restoreAllMocks());

function withQuery(ui: ReactElement) {
  return <QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>;
}

/** Todo lo que se toca tiene rol y nombre, y los interruptores también. */
function expectLabelled(role: 'button' | 'switch') {
  for (const element of screen.queryAllByRole(role)) {
    const label = element.props.accessibilityLabel;
    expect(typeof label === 'string' && label.trim().length > 0).toBe(true);
  }
}

const SCREENS: [string, () => ReactElement, string][] = [
  ['Estado', () => withQuery(<Status />), 'Reintentar'],
  ['Historial', () => withQuery(<History />), 'Reintentar'],
  ['Ajustes', () => withQuery(<Settings />), 'Borrar mis datos'],
  ['onboarding: rol', () => <RoleScreen />, 'Vigilar mi casa'],
  ['onboarding: notificaciones', () => <Notifications />, 'Permitir notificaciones'],
  ['onboarding: batería', () => <Battery />, 'Listo, ya lo hice'],
  ['onboarding: red de casa', () => <HomeNetwork />, 'Ya estoy conectado'],
  [
    'guía de batería',
    () => withQuery(<BatteryGuideScreen onDone={() => {}} />),
    'Listo, ya lo hice',
  ],
  ['diagnóstico', () => <Debug />, 'Exportar'],
];

it.each(SCREENS)('%s: cada botón tiene nombre accesible', async (_name, ui, anchor) => {
  await render(ui());
  expect(await screen.findByText(anchor)).toBeOnTheScreen();
  expect(screen.queryAllByRole('button').length).toBeGreaterThan(0);
  expectLabelled('button');
});

it.each([
  ['Ajustes', () => withQuery(<Settings />)],
  ['diagnóstico', () => <Debug />],
])('%s: cada interruptor tiene nombre accesible', async (_name, ui) => {
  await render(ui());
  expect(await screen.findAllByRole('switch')).not.toHaveLength(0);
  expectLabelled('switch');
});
