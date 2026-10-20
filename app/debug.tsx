import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  PermissionsAndroid,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type {
  NativeDiagnostics,
  NativeEvent,
  ReportValue,
} from '../src/modules/power-detection/native-schema';
import {
  exportAndShare,
  learnHomeNetwork,
  readDiagnostics,
  readEvents,
  recordAppOpen,
  recordReport,
  setForegroundServiceEnabled,
} from '../src/modules/power-detection/power-monitor';
import { colors } from '../src/shared/theme/colors';
import { formatCaracas } from '../src/shared/time/caracas';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const REPORT_BUTTONS: { label: string; value: ReportValue }[] = [
  { label: 'Se fue la luz ahora', value: 'sin_luz' },
  { label: 'Volvió', value: 'hay_luz' },
  { label: 'Fluctuando', value: 'fluctuando' },
];

// UsageStatsManager: 5 exempted, 10 active, 20 working_set, 30 frequent, 40 rare, 45 restricted
const BUCKETS: Record<number, string> = {
  5: 'exento',
  10: 'activo',
  20: 'en uso',
  30: 'frecuente',
  40: 'raro',
  45: 'restringido',
};

function describe(event: NativeEvent): string {
  if (event.kind === 'snapshot') {
    const power = event.plugged ? '⚡ corriente' : '🔋 sin corriente';
    const wifi = event.onWifi ? `📶 Wi-Fi${event.internet ? '' : ' sin internet'}` : '✕ sin Wi-Fi';
    const home = event.homeWifi === null ? '' : event.homeWifi ? ' · 🏠 casa' : ' · otra red';
    return `${event.source} · ${power} · ${wifi}${home}`;
  }
  if (event.kind === 'report') return `reporte · ${event.value}`;
  return `confirmación · ${event.answer ? 'sí' : 'no'}`;
}

function describeDiagnostics(d: NativeDiagnostics): string {
  const bucket =
    d.standbyBucket === null ? '?' : (BUCKETS[d.standbyBucket] ?? String(d.standbyBucket));
  const armed = [
    d.armed.networkCallback && 'A',
    d.armed.heartbeat && 'B',
    d.armed.chargingJob && 'C',
    d.armed.foregroundService && 'D',
  ]
    .filter(Boolean)
    .join(' ');
  return [
    `${d.manufacturer} ${d.model} · Android SDK ${d.sdkInt} · app ${d.appVersion}`,
    `Bucket: ${bucket} · Sin restricción de batería: ${d.ignoringBatteryOptimizations ? 'sí' : 'no'}`,
    `Armados: ${armed || 'ninguno'} · Red de casa: ${d.homeNetworkLearned ? 'aprendida' : 'no'}`,
  ].join('\n');
}

export default function DebugScreen() {
  const [events, setEvents] = useState<NativeEvent[]>([]);
  const [invalid, setInvalid] = useState(0);
  const [diagnostics, setDiagnostics] = useState<NativeDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showError = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await readEvents(Date.now() - FOURTEEN_DAYS_MS);
      setEvents(result.events);
      setInvalid(result.invalid);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    try {
      setDiagnostics(await readDiagnostics());
    } catch {
      setDiagnostics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const run = (action: () => Promise<unknown>, done?: string) => async () => {
    try {
      await action();
      if (done) setNotice(done);
      await refresh();
    } catch (e) {
      showError(e);
    }
  };

  const toggleForegroundService = async (enabled: boolean) => {
    try {
      if (enabled) {
        const result = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Sin permiso de notificaciones el servicio no puede mostrarse');
          return;
        }
      }
      await setForegroundServiceEnabled(enabled);
      await refresh();
    } catch (e) {
      showError(e);
    }
  };

  const learnHome = run(async () => {
    const learned = await learnHomeNetwork();
    if (!learned) throw new Error('Conéctate al Wi-Fi de tu casa y vuelve a intentarlo');
  }, 'Listo: esta es la red de tu casa');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registrador</Text>
      <Text style={styles.counters}>
        Guardados: {events.length} · Inválidos: {invalid}
      </Text>
      {diagnostics ? (
        <Text style={styles.diagnostics}>{describeDiagnostics(diagnostics)}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.reports}>
        {REPORT_BUTTONS.map(({ label, value }) => (
          <Pressable
            key={value}
            style={styles.reportButton}
            onPress={run(() => recordReport(value), `Guardado: ${label}`)}
            accessibilityRole="button"
          >
            <Text style={styles.reportText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={run(recordAppOpen)} accessibilityRole="button">
          <Text style={styles.buttonText}>Registrar ahora</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={learnHome} accessibilityRole="button">
          <Text style={styles.secondaryText}>Esta es la red de mi casa</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={run(exportAndShare)}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Exportar</Text>
        </Pressable>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Servicio en primer plano (D)</Text>
        <Switch
          value={diagnostics?.armed.foregroundService ?? false}
          onValueChange={toggleForegroundService}
        />
      </View>

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
  diagnostics: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  error: { color: '#FF6B6B', marginTop: 8 },
  notice: { color: colors.accent, marginTop: 8 },
  reports: { flexDirection: 'row', gap: 8, marginTop: 16 },
  reportButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  reportText: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  actions: { gap: 8, marginVertical: 12 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  secondary: {
    borderColor: colors.surface,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 15 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  switchLabel: { color: colors.text, fontSize: 15 },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface,
  },
  time: { color: colors.textMuted, fontSize: 12 },
  detail: { color: colors.text, fontSize: 15, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 32 },
});
