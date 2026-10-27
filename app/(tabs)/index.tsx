import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  describeError,
  formatAgo,
  formatPhoneState,
  formatStatus,
} from '../../src/modules/home/format';
import { currentPhoneState } from '../../src/modules/home/phone-state';
import { useHomeStatus, usePhoneEvents, useRole } from '../../src/modules/home/queries';
import {
  Button,
  Card,
  ErrorBlock,
  FollowOnlyPlaceholder,
  Muted,
  SectionTitle,
  TabScreen,
} from '../../src/modules/home/ui';
import type { ReportValue } from '../../src/modules/power-detection/native-schema';
import { recordReport } from '../../src/modules/power-detection/power-monitor';
import type { HomeStatus } from '../../src/shared/api/generated/types.gen';
import { colors } from '../../src/shared/theme/colors';

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

export default function StatusTab() {
  const role = useRole();
  if (role.isPending) return <TabScreen title="Estado">{null}</TabScreen>;
  if (role.data === 'follow') return <FollowOnlyPlaceholder />;
  return <HomeStatusScreen />;
}

function HomeStatusScreen() {
  const status = useHomeStatus();
  const phoneEvents = usePhoneEvents();
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const { refetch: refetchStatus } = status;
  const { refetch: refetchPhone } = phoneEvents;
  // Al volver a esta pestaña se refresca; `cancelRefetch: false` evita repetir el pedido de la primera carga.
  useFocusEffect(
    useCallback(() => {
      void refetchStatus({ cancelRefetch: false });
      void refetchPhone({ cancelRefetch: false });
    }, [refetchStatus, refetchPhone]),
  );

  const refresh = () => {
    void refetchStatus();
    void refetchPhone();
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

  const now = Date.now();
  const home = status.data;
  const phone = phoneEvents.data ? currentPhoneState(phoneEvents.data) : null;

  return (
    <TabScreen title="Estado" refreshing={status.isRefetching} onRefresh={refresh}>
      {home ? (
        <Card>
          <Text style={styles.alias}>{home.status.alias}</Text>
          <Text style={[styles.status, { color: STATE_COLOR[home.status.state] }]}>
            {formatStatus(home.status, now)}
          </Text>
          {home.receivedAt !== null ? (
            <Muted>{`Sin conexión. Es lo último que dio el servidor, ${formatAgo(home.receivedAt, now)}.`}</Muted>
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
          ) : phoneEvents.isError ? (
            <Muted>No se pudo leer el estado del teléfono.</Muted>
          ) : phoneEvents.isSuccess ? (
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
  noticeError: { color: colors.danger, fontSize: 15 },
});
