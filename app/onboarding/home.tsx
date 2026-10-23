import { useState } from 'react';
import { finishOnboarding } from '../../src/modules/onboarding/progress';
import {
  Message,
  OnboardingScreen,
  PrimaryButton,
  SecondaryButton,
} from '../../src/modules/onboarding/ui';
import { learnHomeNetwork } from '../../src/modules/power-detection/power-monitor';

export default function HomeNetwork() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const learn = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (await learnHomeNetwork()) {
        await finishOnboarding();
      } else {
        setError('No veo el Wi-Fi. Conéctate al Wi-Fi de tu casa y toca de nuevo.');
      }
    } catch {
      setError('No se pudo leer la red. Conéctate al Wi-Fi de tu casa y toca de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingScreen
      title="Conéctate al Wi-Fi de tu casa"
      intro="Pulso recuerda la red de tu casa para saber cuándo el teléfono está en ella. No lee el nombre de tu Wi-Fi ni usa tu ubicación."
    >
      <PrimaryButton label="Ya estoy conectado" onPress={learn} disabled={busy} />
      <SecondaryButton
        label="Lo hago después"
        onPress={() => void finishOnboarding()}
        disabled={busy}
      />
      {error ? <Message tone="error">{error}</Message> : null}
    </OnboardingScreen>
  );
}
