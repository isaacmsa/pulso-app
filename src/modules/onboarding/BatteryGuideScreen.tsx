import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { UpsModeSwitch } from '../home/UpsModeSwitch';
import {
  type BatterySettingsKind,
  openBatterySettings,
  readDiagnostics,
} from '../power-detection/power-monitor';
import { type BatteryStep, batteryGuide } from './battery-guide';
import { Card, Message, OnboardingScreen, PrimaryButton, SecondaryButton, textStyles } from './ui';

/** La guía para que el teléfono no cierre Pulso. La usan el onboarding y Estado; `onDone` decide qué sigue. */
export function BatteryGuideScreen({ onDone }: { onDone: () => void | Promise<void> }) {
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
      <PrimaryButton label="Listo, ya lo hice" onPress={() => void onDone()} />
    </OnboardingScreen>
  );
}
