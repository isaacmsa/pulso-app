import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { register } from '../../src/modules/onboarding/register';
import {
  Message,
  OnboardingScreen,
  PrimaryButton,
  SecondaryButton,
} from '../../src/modules/onboarding/ui';
import {
  getOnboardingStep,
  getRole,
  type Role,
} from '../../src/modules/power-detection/power-monitor';
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
  const [checking, setChecking] = useState(true);

  // Si la app murió después del registro (por ejemplo en los ajustes de batería), se retoma en el paso que falta
  // sin volver a preguntar ni a registrar.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [step, role] = await Promise.all([getOnboardingStep(), getRole()]);
        if (!alive) return;
        if (step === 'notifications' && role) {
          router.replace({ pathname: '/onboarding/notifications', params: { role } });
          return;
        }
        if (step === 'battery' || step === 'home') {
          router.replace(`/onboarding/${step}`);
          return;
        }
      } catch (e) {
        console.warn('No se pudo leer el paso del onboarding', e);
      }
      if (alive) setChecking(false);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

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

  if (checking) return null;

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
      <Message tone="muted">Seguir casas llega en la próxima actualización.</Message>
      {busy ? <Message tone="muted">Registrando este teléfono…</Message> : null}
      {error ? <Message tone="error">{error}</Message> : null}
    </OnboardingScreen>
  );
}
