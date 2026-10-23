import { useRouter } from 'expo-router';
import { useState } from 'react';
import { register } from '../../src/modules/onboarding/register';
import {
  Message,
  OnboardingScreen,
  PrimaryButton,
  SecondaryButton,
} from '../../src/modules/onboarding/ui';
import type { Role } from '../../src/modules/power-detection/power-monitor';
import { ApiError } from '../../src/shared/api/client';

function describeError(error: unknown): string {
  if (error instanceof ApiError && (error.code === 'network' || error.code === 'timeout')) {
    return 'Sin conexión con el servidor. Revisa tu internet y toca de nuevo.';
  }
  return 'No se pudo registrar este teléfono. Toca de nuevo para reintentar.';
}

export default function ChooseRole() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (role: Role) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await register(role);
      router.push({ pathname: '/onboarding/notifications', params: { role } });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingScreen
      title="¿Este teléfono se queda en casa?"
      intro="Si se queda enchufado en casa, Pulso detecta solo cuándo se va y cuándo vuelve la luz. Si no, puedes seguir la casa de otra persona."
    >
      <PrimaryButton label="Vigilar mi casa" onPress={() => choose('watch')} disabled={busy} />
      <SecondaryButton
        label="Solo seguir una casa"
        onPress={() => choose('follow')}
        disabled={busy}
      />
      {busy ? <Message tone="muted">Registrando este teléfono…</Message> : null}
      {error ? <Message tone="error">{error}</Message> : null}
    </OnboardingScreen>
  );
}
