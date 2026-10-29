import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HomeStatus } from '../../../shared/api/generated/types.gen';
import { colors } from '../../../shared/theme/colors';
import type { ReportValue } from '../../power-detection/native-schema';
import { recordReport } from '../../power-detection/power-monitor';
import { BATTERY_GUIDE_ROUTE, detectionRisk } from '../detection-risk';
import { describeError, formatAgo, formatPhoneState, formatStatus } from '../format';
import { useDiagnostics, useHomeStatus, usePhoneState, useRole } from '../queries';
import {
  Button,
  Card,
  ErrorBlock,
  FollowOnlyPlaceholder,
  Muted,
  SectionTitle,
  TabScreen,
} from '../ui';

const REPORTS: { label: string; value: ReportValue }[] = [
  { label: 'Hay luz', value: 'hay_luz' },
  { label: 'Fluctuando', value: 'fluctuando' },
  { label: 'Sin luz', value: 'sin_luz' },
];

const STATE_COLOR: Record<HomeStatus['state'], string> = {
  con_luz: colors.ok,
  sin_luz: colors.danger,
  sin_noticias: colors.warn,
};

export default function StatusScreen() {
  const role = useRole();
  if (role.isPending) return <TabScreen title="Estado">{null}</TabScreen>;
  if (role.data === 'follow') return <FollowOnlyPlaceholder />;
  return <HomeStatusScreen />;
}

/** Un reloj que se mueve cada minuto, para que el aviso de latido viejo aparezca aunque nada más cambie. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function HomeStatusScreen() {
  const status = useHomeStatus();
  const phoneState = usePhoneState();
  const diagnostics = useDiagnostics(true);
  const router = useRouter();
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const { refetch: refetchStatus } = status;
  const { refetch: refetchPhone } = phoneState;
  const { refetch: refetchDiagnostics } = diagnostics;
  // Al volver a esta pestaña se refresca; `cancelRefetch: false` evita repetir el pedido de la primera carga.
  useFocusEffect(
    useCallback(() => {
      void refetchStatus({ cancelRefetch: false });
      void refetchPhone({ cancelRefetch: false });
      void refetchDiagnostics({ cancelRefetch: false });
    }, [refetchStatus, refetchPhone, refetchDiagnostics]),
  );

  const refresh = () => {
    void refetchStatus();
    void refetchPhone();
    void refetchDiagnostics();
  };

  const report = async (value: ReportValue) => {
    try {
      await recordReport(value);
      setNotice({ text: 'Listo, quedó anotado.', error: false });
      void refetchPhone();
    } catch {
      setNotice({ text: 'No se pudo guardar el reporte. Intenta de nuevo.', error: true });
    }
  };

  const clock = useMinuteClock();
  // Cada render con datos nuevos toma la hora de ese momento; el reloj garantiza al menos uno por minuto.
  const now = Math.max(Date.now(), clock);
  const home = status.data;
  const phone = phoneState.data;
  const risk = detectionRisk(diagnostics.data ?? null, phone?.lastAt ?? null, now);

  return (
    <TabScreen title="Estado" refreshing={status.isRefetching} onRefresh={refresh}>
      {risk ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="La detección puede fallar: tu teléfono está limitando a Pulso. Revisar la batería"
          onPress={() => router.push(BATTERY_GUIDE_ROUTE)}
          style={styles.risk}
        >
          <Text style={styles.riskTitle}>La detección puede fallar</Text>
          <Text style={styles.riskBody}>Tu teléfono está limitando a Pulso.</Text>
          <Text style={styles.riskAction}>Revisar la batería</Text>
        </Pressable>
      ) : null}
      {home ? (
        <Card>
          <Text style={styles.alias}>{home.status.alias}</Text>
          <Text style={[styles.status, { color: STATE_COLOR[home.status.state] }]}>
            {formatStatus(home.status, now)}
          </Text>
          {home.receivedAt !== null ? (
            <Muted>{`Sin conexión. Es lo último que dio el servidor, ${formatAgo(home.receivedAt, now)}.`}</Muted>
          ) : null}
          {/* Un refresco que falló por otra cosa que la red (5xx, 429, 401, contrato) deja el dato viejo. */}
          {status.isError ? (
            <Muted>No se pudo actualizar. Esto es lo último que se guardó.</Muted>
          ) : null}
        </Card>
      ) : status.isError ? (
        <ErrorBlock message={describeError(status.error)} onRetry={() => void refetchStatus()} />
      ) : (
        <Card>
          <Muted>Cargando…</Muted>
        </Card>
      )}

      <View style={styles.section}>
        <SectionTitle>Este teléfono</SectionTitle>
        <Card>
          {phone ? (
            <Text style={styles.phone}>{formatPhoneState(phone.plugged, phone.since, now)}</Text>
          ) : phoneState.isError ? (
            <Muted>No se pudo leer el estado del teléfono.</Muted>
          ) : phoneState.isSuccess ? (
            <Muted>Todavía no hay lecturas de este teléfono.</Muted>
          ) : (
            <Muted>Cargando…</Muted>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>¿Cómo está la luz ahora?</SectionTitle>
        <View style={styles.reports}>
          {REPORTS.map(({ label, value }) => (
            <View key={value} style={styles.reportButton}>
              <Button label={label} onPress={() => void report(value)} />
            </View>
          ))}
        </View>
        {notice ? (
          <Text style={notice.error ? styles.noticeError : styles.notice}>{notice.text}</Text>
        ) : null}
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  alias: { color: colors.textMuted, fontSize: 15 },
  status: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  phone: { color: colors.text, fontSize: 18 },
  section: { gap: 8 },
  reports: { flexDirection: 'row', gap: 8 },
  reportButton: { flex: 1 },
  notice: { color: colors.ok, fontSize: 15 },
  risk: {
    backgroundColor: colors.surface,
    borderColor: colors.warn,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  riskTitle: { color: colors.warn, fontSize: 17, fontWeight: '700' },
  riskBody: { color: colors.text, fontSize: 15 },
  riskAction: { color: colors.warn, fontSize: 15, fontWeight: '600', marginTop: 4 },
  noticeError: { color: colors.danger, fontSize: 15 },
});
