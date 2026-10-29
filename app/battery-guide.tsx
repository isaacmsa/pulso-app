import { useRouter } from 'expo-router';
import { BatteryGuideScreen } from '../src/modules/onboarding/BatteryGuideScreen';

/** La misma guía para un teléfono con sesión (se abre desde el aviso de Estado): "Listo" solo vuelve. */
export default function BatteryGuide() {
  const router = useRouter();
  return <BatteryGuideScreen onDone={() => router.back()} />;
}
