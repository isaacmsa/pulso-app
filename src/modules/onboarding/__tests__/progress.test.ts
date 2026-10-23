import * as native from '../../power-detection/power-monitor';
import { advanceOnboarding, finishOnboarding } from '../progress';
import * as startup from '../startup';

jest.mock('../../power-detection/power-monitor', () => ({ setOnboardingStep: jest.fn() }));
jest.mock('../startup', () => ({ notifyStartupChanged: jest.fn() }));

const mocked = native as jest.Mocked<typeof native>;

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

it('advanceOnboarding guarda el paso en el nativo', async () => {
  mocked.setOnboardingStep.mockResolvedValue(undefined);
  await advanceOnboarding('battery');
  expect(mocked.setOnboardingStep).toHaveBeenCalledWith('battery');
});

it('finishOnboarding borra la marca y avisa a la raíz', async () => {
  mocked.setOnboardingStep.mockResolvedValue(undefined);
  await finishOnboarding();
  expect(mocked.setOnboardingStep).toHaveBeenCalledWith(null);
  expect(startup.notifyStartupChanged).toHaveBeenCalledTimes(1);
});

it('si el nativo falla al guardar, no corta el onboarding', async () => {
  mocked.setOnboardingStep.mockRejectedValue(new Error('boom'));
  await expect(advanceOnboarding('home')).resolves.toBeUndefined();
  await expect(finishOnboarding()).resolves.toBeUndefined();
  expect(startup.notifyStartupChanged).toHaveBeenCalledTimes(1);
});
