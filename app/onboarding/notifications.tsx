import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { notifyStartupChanged } from '../../src/modules/onboarding/startup';
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

  const next = () => {
    // "Solo seguir" no detecta nada: se salta la batería y la red de casa.
    if (role === 'follow') notifyStartupChanged();
    else router.push('/onboarding/battery');
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
      next();
    } catch {
      setError('No se pudo pedir el permiso. Puedes seguir y activarlo después en los ajustes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingScreen
      title="Avisos de la luz"
      intro="Pulso te avisa cuando se va y cuando vuelve la luz en la casa que sigues. Para eso necesita permiso para enviarte notificaciones."
    >
      <PrimaryButton label="Permitir notificaciones" onPress={allow} disabled={busy} />
      <SecondaryButton label="Ahora no" onPress={next} disabled={busy} />
      {error ? <Message tone="error">{error}</Message> : null}
    </OnboardingScreen>
  );
}
