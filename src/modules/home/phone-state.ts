import type { NativeEvent } from '../power-detection/native-schema';

/**
 * El estado crudo del teléfono: si está en corriente y desde cuándo, según sus snapshots (sin tocar al servidor).
 * `since` es el primer snapshot de la racha actual: lo más viejo que el teléfono recuerda con ese mismo estado.
 */
export function currentPhoneState(
  events: NativeEvent[],
): { plugged: boolean; since: number } | null {
  const snapshots = events.filter((event) => event.kind === 'snapshot').sort((a, b) => b.at - a.at);
  const newest = snapshots[0];
  if (!newest) return null;
  let since = newest.at;
  for (const snapshot of snapshots) {
    if (snapshot.plugged !== newest.plugged) break;
    since = snapshot.at;
  }
  return { plugged: newest.plugged, since };
}
