import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import {
  setupNotifications,
  startConfirmationResponses,
} from '../src/modules/notifications/confirmation';
import { registerPushToken, startPushTokenSync } from '../src/modules/notifications/push-token';
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

async function keepSplash() {
  await SplashScreen.preventAutoHideAsync();
}

async function hideSplash() {
  try {
    await SplashScreen.hideAsync();
  } catch {
    // Si ya estaba oculta no pasa nada.
  }
}

// La pantalla de arranque sigue visible hasta que se sabe a dónde ir (onboarding o pestañas): nada de pantalla en blanco.
keepSplash().catch(() => undefined);

// El token vive en la bóveda nativa: el cliente lo pide en cada llamada y JS no lo guarda.
setTokenProvider(getToken);
// Un 401 invalid_token en cualquier pantalla marca el token y devuelve al onboarding (I3).
installInvalidTokenHandler();
// Los avisos se muestran aunque la app esté abierta, y "¿Se fue la luz?" lleva los botones Sí y No (D-028).
setupNotifications().catch((error: unknown) =>
  console.warn('No se pudo preparar los avisos', error),
);

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

  // Quien vigila y quien solo sigue reciben avisos: los dos mandan su push token. Si el permiso o el projectId faltan,
  // `registerPushToken` no hace nada. Al terminar el onboarding `startup` cambia y esto corre con el permiso ya pedido.
  const signedIn = startup === 'watch' || startup === 'follow';
  useEffect(() => {
    if (!signedIn) return;
    void registerPushToken();
    const stopSync = startPushTokenSync();
    const stopResponses = startConfirmationResponses();
    return () => {
      stopSync();
      stopResponses();
    };
  }, [signedIn]);

  useEffect(() => {
    if (startup !== null) void hideSplash();
  }, [startup]);

  if (startup === null) return null;

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
          <Stack.Screen name="battery-guide" />
        </Stack.Protected>
      </Stack>
    </PersistQueryClientProvider>
  );
}
