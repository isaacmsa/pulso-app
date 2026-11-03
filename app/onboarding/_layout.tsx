import { Stack } from 'expo-router';
import { colors } from '../../src/shared/theme/colors';

export const unstable_settings = { initialRouteName: 'index' };

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
