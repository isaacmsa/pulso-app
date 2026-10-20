import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeEvent } from '../src/modules/power-detection/native-schema';
import { readEvents, recordAppOpen } from '../src/modules/power-detection/power-monitor';
import { colors } from '../src/shared/theme/colors';
import { formatCaracas } from '../src/shared/time/caracas';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function describe(event: NativeEvent): string {
  if (event.kind === 'snapshot') {
    const power = event.plugged ? '⚡ corriente' : '🔋 sin corriente';
    const wifi = event.onWifi ? `📶 Wi-Fi${event.internet ? '' : ' sin internet'}` : '✕ sin Wi-Fi';
    return `${event.source} · ${power} · ${wifi}`;
  }
  if (event.kind === 'report') return `reporte · ${event.value}`;
  return `confirmación · ${event.answer ? 'sí' : 'no'}`;
}

export default function DebugScreen() {
  const [events, setEvents] = useState<NativeEvent[]>([]);
  const [invalid, setInvalid] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await readEvents(Date.now() - FOURTEEN_DAYS_MS);
      setEvents(result.events);
      setInvalid(result.invalid);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const recordNow = async () => {
    try {
      await recordAppOpen();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registrador</Text>
      <Text style={styles.counters}>
        Guardados: {events.length} · Inválidos: {invalid}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={recordNow} accessibilityRole="button">
        <Text style={styles.buttonText}>Registrar ahora</Text>
      </Pressable>
      <FlatList
        data={events.slice(0, 50)}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.time}>{formatCaracas(item.at)}</Text>
            <Text style={styles.detail}>{describe(item)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Todavía no hay eventos.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56, paddingHorizontal: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  counters: { color: colors.textMuted, marginTop: 4 },
  error: { color: '#FF6B6B', marginTop: 8 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 16,
  },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface,
  },
  time: { color: colors.textMuted, fontSize: 12 },
  detail: { color: colors.text, fontSize: 15, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 32 },
});
