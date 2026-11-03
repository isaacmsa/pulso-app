import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../shared/theme/colors';

export function TabScreen({
  title,
  children,
  refreshing,
  onRefresh,
}: {
  title: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  // Con edge-to-edge la barra de estado es transparente: sin el borde superior, al hacer scroll el contenido pasa
  // por debajo de la hora y la batería.
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        testID="tab-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  tone = 'secondary',
  disabled,
  singleLine,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  /** Para botones angostos en fila: achica la letra en vez de partir la palabra ("Fluctuan / do"). */
  singleLine?: boolean;
}) {
  return (
    <Pressable
      style={[styles.button, styles[tone], disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text
        style={[styles.buttonText, tone === 'primary' && styles.primaryText]}
        numberOfLines={singleLine ? 1 : undefined}
        adjustsFontSizeToFit={singleLine}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <Text style={styles.error} accessibilityRole="alert">
        {message}
      </Text>
      <Button label="Reintentar" onPress={onRetry} />
    </Card>
  );
}

/** Lo que ven Estado e Historial en un teléfono que no vigila ninguna casa: sus casas están en Familia (D-040). */
export function FollowOnlyPlaceholder() {
  return (
    <TabScreen title="Pulso">
      <Card>
        <Text style={styles.placeholderTitle}>Este teléfono solo sigue casas</Text>
        <Text style={styles.muted}>
          Las casas que sigues están en la pestaña Familia. Si este teléfono se queda en casa,
          puedes vigilarla desde Ajustes.
        </Text>
      </Card>
    </TabScreen>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  button: {
    borderRadius: 12,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  secondary: { borderColor: colors.textMuted, borderWidth: 1 },
  danger: { borderColor: colors.danger, borderWidth: 1 },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  primaryText: { color: colors.background },
  error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
  placeholderTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
});
