import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import {
  arm,
  configureApi,
  getToken,
  recordAppOpen,
} from '../src/modules/power-detection/power-monitor';
import { resolveApiUrl, setTokenProvider } from '../src/shared/api/client';
import { colors } from '../src/shared/theme/colors';

// El token vive en la bóveda nativa: el cliente lo pide en cada llamada y JS no lo guarda.
setTokenProvider(getToken);

export default function RootLayout() {
  useEffect(() => {
    configureApi(resolveApiUrl(process.env.EXPO_PUBLIC_API_URL)).catch((error: unknown) =>
      console.warn('No se pudo guardar la URL de la API', error),
    );
    arm()
      .then(recordAppOpen)
      .catch((error: unknown) => console.warn('No se pudo armar la detección', error));
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}
