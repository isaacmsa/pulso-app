import { useQueryClient } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { DAY_MS } from '../../../shared/time/caracas';
import { describeError, formatDuration, weekdayLabel, weekRange } from '../format';
import { barHeights, compareWeeks, weekdayFull, weekdayShort } from '../history-chart';
import { useOutages, useRole } from '../queries';
import { Card, ErrorBlock, FollowOnlyPlaceholder, Muted, SectionTitle, TabScreen } from '../ui';

export default function HistoryScreen() {
  const role = useRole();
  if (role.isPending) return <TabScreen title="Historial">{null}</TabScreen>;
  if (role.data === 'follow') return <FollowOnlyPlaceholder />;
  return <WeekHistory />;
}

type Outages = NonNullable<ReturnType<typeof useOutages>['data']>;

/** La semana guardada que termina más tarde (la clave es ['home', 'outages', from, to]). */
function latestCachedWeek(
  entries: [readonly unknown[], Outages | undefined][],
): Outages | undefined {
  let best: Outages | undefined;
  let bestTo = Number.NEGATIVE_INFINITY;
  for (const [key, data] of entries) {
    const to = key[3];
    if (data && typeof to === 'number' && to > bestTo) {
      best = data;
      bestTo = to;
    }
  }
  return best;
}

function WeekHistory() {
  // Los 7 días de Caracas que terminan hoy. Los límites son medianoches, así que la clave de la consulta no cambia en todo el día.
  const { from, to } = weekRange(Date.now());
  const outages = useOutages(from, to);
  // Pasada la medianoche la clave cambia y, sin red, la semana nueva no tiene datos: se cae a la semana más reciente guardada.
  const queryClient = useQueryClient();
  const cached =
    outages.data || !outages.isError
      ? undefined
      : latestCachedWeek(queryClient.getQueriesData<Outages>({ queryKey: ['home', 'outages'] }));
  const history = outages.data ?? cached;
  // Los 7 días anteriores, para comparar. Si falla o no hay datos, simplemente no se muestra la comparación.
  const previous = useOutages(from - 7 * DAY_MS, from);
  const heights = history ? barHeights(history.days.map((d) => d.ms)) : [];
  const comparison = history ? compareWeeks(history.totalMs, previous.data?.totalMs) : null;

  return (
    <TabScreen
      title="Historial"
      refreshing={outages.isRefetching || previous.isRefetching}
      onRefresh={() => void Promise.all([outages.refetch(), previous.refetch()])}
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
            {comparison ? <Text style={styles.comparison}>{comparison}</Text> : null}
            {history.totalMs > 0 ? (
              <View style={styles.bars}>
                {history.days.map((day, i) => {
                  const height = heights[i] ?? 0;
                  return (
                    <View
                      key={day.date}
                      style={styles.barColumn}
                      accessible
                      accessibilityLabel={
                        day.ms > 0
                          ? `${weekdayFull(day.date)}: ${formatDuration(day.ms)} sin luz`
                          : `${weekdayFull(day.date)}: sin cortes`
                      }
                    >
                      <View style={styles.barTrack}>
                        {day.ms > 0 ? (
                          <View
                            testID="bar-fill"
                            style={[styles.barFill, { height: `${height * 100}%` }]}
                          />
                        ) : null}
                      </View>
                      <Text style={styles.barLabel}>{weekdayShort(day.date)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
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
  comparison: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  bars: { flexDirection: 'row', gap: 6, marginTop: 16 },
  barColumn: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { height: 96, width: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: colors.warn, borderRadius: 4 },
  barLabel: { color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  day: { color: colors.text, fontSize: 16 },
  hours: { color: colors.text, fontSize: 16, fontWeight: '600' },
  none: { color: colors.textMuted, fontSize: 16 },
});
