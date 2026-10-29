import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { installInvalidTokenHandler, useStartup } from '../src/modules/onboarding/startup';
import {
  arm,
  configureApi,
  getToken,
  recordAppOpen,
} from '../src/modules/power-detection/power-monitor';
import { resolveApiUrl, setTokenProvider } from '../src/shared/api/client';
import { persistOptions, queryClient } from '../src/shared/query/client';
import { colors } from '../src/shared/theme/colors';

// El token vive en la bóveda nativa: el cliente lo pide en cada llamada y JS no lo guarda.
setTokenProvider(getToken);
// Un 401 invalid_token en cualquier pantalla marca el token y devuelve al onboarding (I3).
installInvalidTokenHandler();

export default function RootLayout() {
  const startup = useStartup();

  useEffect(() => {
    if (startup !== 'watch' && startup !== 'follow') return;
    configureApi(resolveApiUrl(process.env.EXPO_PUBLIC_API_URL)).catch((error: unknown) =>
      console.warn('No se pudo guardar la URL de la API', error),
    );
    // Solo un teléfono que vigila una casa arma la detección: "Solo seguir" no detecta nada.
    if (startup === 'watch') {
      arm()
        .then(recordAppOpen)
        .catch((error: unknown) => console.warn('No se pudo armar la detección', error));
    }
  }, [startup]);

  if (startup === null) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={startup === 'onboarding'}>
          <Stack.Screen name="onboarding/index" />
          <Stack.Screen name="onboarding/notifications" />
          <Stack.Screen name="onboarding/battery" />
          <Stack.Screen name="onboarding/home" />
        </Stack.Protected>
        <Stack.Protected guard={startup !== 'onboarding'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="debug" />
        </Stack.Protected>
      </Stack>
    </PersistQueryClientProvider>
  );
}
