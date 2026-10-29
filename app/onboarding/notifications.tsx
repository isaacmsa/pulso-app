import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { advanceOnboarding, finishOnboarding } from '../../src/modules/onboarding/progress';
import {
  Message,
  OnboardingScreen,
  PrimaryButton,
  SecondaryButton,
} from '../../src/modules/onboarding/ui';

export default function Notifications() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = async () => {
    // "Solo seguir" no detecta nada: se salta la batería y la red de casa.
    if (role === 'follow') {
      await finishOnboarding();
      return;
    }
    await advanceOnboarding('battery');
    router.push('/onboarding/battery');
  };

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // POST_NOTIFICATIONS existe desde Android 13 (API 33); antes no hay que pedirlo.
      // Si la persona lo niega, sigue igual: las notificaciones se pueden activar después en los ajustes.
      if (Number(Platform.Version) >= 33) {
        await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
      }
      await next();
    } catch {
      setError('No se pudo pedir el permiso. Puedes seguir y activarlo después en los ajustes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingScreen
      title="Notificaciones"
      intro="Este permiso lo usa el servicio en primer plano, si lo activas en Ajustes. Los avisos de cuando se va y vuelve la luz llegan en la próxima actualización."
    >
      <PrimaryButton label="Permitir notificaciones" onPress={allow} disabled={busy} />
      <SecondaryButton label="Ahora no" onPress={() => void next()} disabled={busy} />
      {error ? <Message tone="error">{error}</Message> : null}
    </OnboardingScreen>
  );
}
