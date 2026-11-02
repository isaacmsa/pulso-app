import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../shared/theme/colors';

export function OnboardingScreen({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      {children}
    </ScrollView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primary, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.secondary, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

export function Message({ children, tone }: { children: string; tone: 'error' | 'muted' }) {
  return (
    <Text style={tone === 'error' ? styles.error : styles.muted} accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export const textStyles = StyleSheet.create({
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  cardBody: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
});

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', gap: 16, padding: 24 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  intro: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    minHeight: 48,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: colors.background, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  secondary: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.accent, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  error: { color: '#FF8A80', fontSize: 15, lineHeight: 22 },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 8 },
});
