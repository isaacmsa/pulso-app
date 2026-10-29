import { useRouter } from 'expo-router';
import { BatteryGuideScreen } from '../../src/modules/onboarding/BatteryGuideScreen';
import { advanceOnboarding } from '../../src/modules/onboarding/progress';

export default function Battery() {
  const router = useRouter();
  return (
    <BatteryGuideScreen
      onDone={async () => {
        await advanceOnboarding('home');
        router.push('/onboarding/home');
      }}
    />
  );
}
