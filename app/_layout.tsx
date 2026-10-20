import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { arm, recordAppOpen } from '../src/modules/power-detection/power-monitor';
import { colors } from '../src/shared/theme/colors';

export default function RootLayout() {
  useEffect(() => {
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
