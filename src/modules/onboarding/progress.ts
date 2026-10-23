import { type OnboardingStep, setOnboardingStep } from '../power-detection/power-monitor';
import { notifyStartupChanged } from './startup';

/**
 * Anota el paso que sigue. Si el nativo no puede guardarlo no se corta el onboarding: lo peor que pasa es que, si
 * la app muere, se retome un paso antes.
 */
export async function advanceOnboarding(step: OnboardingStep): Promise<void> {
  try {
    await setOnboardingStep(step);
  } catch (error) {
    console.warn('No se pudo anotar el paso del onboarding', error);
  }
}

/** Da el onboarding por terminado (borra la marca) y avisa a la raíz para que abra la app. */
export async function finishOnboarding(): Promise<void> {
  try {
    await setOnboardingStep(null);
  } catch (error) {
    console.warn('No se pudo cerrar el onboarding', error);
  }
  notifyStartupChanged();
}
