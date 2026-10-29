import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { UpsModeSwitch } from '../../src/modules/home/UpsModeSwitch';
import { type BatteryStep, batteryGuide } from '../../src/modules/onboarding/battery-guide';
import { advanceOnboarding } from '../../src/modules/onboarding/progress';
import {
  Card,
  Message,
  OnboardingScreen,
  PrimaryButton,
  SecondaryButton,
  textStyles,
} from '../../src/modules/onboarding/ui';
import {
  type BatterySettingsKind,
  openBatterySettings,
  readDiagnostics,
} from '../../src/modules/power-detection/power-monitor';

export default function Battery() {
  const router = useRouter();
  // Desde el aviso de Estado, "Listo" solo vuelve: el onboarding ya terminó.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [steps, setSteps] = useState<BatteryStep[] | null>(null);
  const [notOpened, setNotOpened] = useState(false);

  useEffect(() => {
    // Si el diagnóstico falla, se muestra la guía genérica: nunca se deja a la persona sin pasos.
    readDiagnostics()
      .then((d) => setSteps(batteryGuide(d.manufacturer)))
      .catch(() => setSteps(batteryGuide('')));
  }, []);

  const open = async (kind: BatterySettingsKind) => {
    setNotOpened(false);
    try {
      setNotOpened(!(await openBatterySettings(kind)));
    } catch {
      setNotOpened(true);
    }
  };

  return (
    <OnboardingScreen
      title="Que el teléfono no cierre Pulso"
      intro="Algunos teléfonos cierran las apps que nadie abre, y así Pulso no vería el corte. Haz estos pasos una sola vez."
    >
      {steps?.map((step) => (
        <Card key={step.title}>
          <Text style={textStyles.cardTitle}>{step.title}</Text>
          <Text style={textStyles.cardBody}>{step.body}</Text>
          {step.open ? (
            <SecondaryButton
              label="Abrir ajustes"
              onPress={() => open(step.open as BatterySettingsKind)}
            />
          ) : null}
        </Card>
      ))}
      {notOpened ? (
        <Message tone="error">
          No se pudo abrir esa pantalla. Ábrelo a mano con los pasos de arriba.
        </Message>
      ) : null}
      <Card>
        <UpsModeSwitch styleText={textStyles.cardTitle} styleMuted={textStyles.cardBody} />
      </Card>
      <PrimaryButton
        label="Listo, ya lo hice"
        onPress={async () => {
          if (from === 'status') {
            router.back();
            return;
          }
          await advanceOnboarding('home');
          router.push('/onboarding/home');
        }}
      />
    </OnboardingScreen>
  );
}
