import { StyleSheet, Text, View } from 'react-native';
import {
  describeError,
  formatDuration,
  weekdayLabel,
  weekRange,
} from '../../src/modules/home/format';
import { useOutages, useRole } from '../../src/modules/home/queries';
import {
  Card,
  ErrorBlock,
  FollowOnlyPlaceholder,
  Muted,
  SectionTitle,
  TabScreen,
} from '../../src/modules/home/ui';
import { colors } from '../../src/shared/theme/colors';

export default function HistoryTab() {
  const role = useRole();
  if (role.isPending) return <TabScreen title="Historial">{null}</TabScreen>;
  if (role.data === 'follow') return <FollowOnlyPlaceholder />;
  return <WeekHistory />;
}

function WeekHistory() {
  // Los 7 días de Caracas que terminan hoy. Los límites son medianoches, así que la clave de la consulta no cambia en todo el día.
  const { from, to } = weekRange(Date.now());
  const outages = useOutages(from, to);
  const history = outages.data;

  return (
    <TabScreen
      title="Historial"
      refreshing={outages.isRefetching}
      onRefresh={() => void outages.refetch()}
    >
      {history ? (
        <>
          <Card>
            <SectionTitle>Total de la semana</SectionTitle>
            {history.totalMs > 0 ? (
              <Text style={styles.total}>{formatDuration(history.totalMs)}</Text>
            ) : (
              <Text style={styles.total}>Sin cortes esta semana</Text>
            )}
            {outages.isError ? (
              <Muted>No se pudo actualizar. Esto es lo último que se guardó.</Muted>
            ) : null}
          </Card>
          <Card>
            {[...history.days].reverse().map((day) => (
              <View key={day.date} style={styles.row}>
                <Text style={styles.day}>{weekdayLabel(day.date)}</Text>
                <Text style={day.ms > 0 ? styles.hours : styles.none}>
                  {day.ms > 0 ? formatDuration(day.ms) : '—'}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : outages.isError ? (
        <ErrorBlock message={describeError(outages.error)} onRetry={() => void outages.refetch()} />
      ) : (
        <Card>
          <Muted>Cargando…</Muted>
        </Card>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  total: { color: colors.text, fontSize: 28, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  day: { color: colors.text, fontSize: 16 },
  hours: { color: colors.text, fontSize: 16, fontWeight: '600' },
  none: { color: colors.textMuted, fontSize: 16 },
});
