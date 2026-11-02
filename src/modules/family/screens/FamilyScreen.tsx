import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import type { FollowItem } from '../../../shared/api/generated/types.gen';
import { colors } from '../../../shared/theme/colors';
import { describeError, formatStatus } from '../../home/format';
import { useRole } from '../../home/queries';
import { Button, Card, ErrorBlock, Muted, SectionTitle, TabScreen } from '../../home/ui';
import { MAX_FOLLOWS, shareMessage } from '../code';
import { regenerate, unfollow, useFollows } from '../queries';
import { readShareCode } from '../share-code';

const STATE_COLOR: Record<FollowItem['status']['state'], string> = {
  con_luz: colors.ok,
  sin_luz: colors.danger,
  sin_noticias: colors.warn,
};

export const REGENERATE_WARNING =
  'Las personas que siguen tu casa dejarán de verla hasta que les mandes el código nuevo';

/** La pestaña Familia: compartir mi casa (si este teléfono la vigila) y las casas que sigo (D-040). */
export default function FamilyScreen() {
  const role = useRole();
  const follows = useFollows();
  const router = useRouter();
  const { refetch } = follows;
  useFocusEffect(
    useCallback(() => {
      void refetch({ cancelRefetch: false });
    }, [refetch]),
  );
  const now = Date.now();
  const items = follows.data;

  return (
    <TabScreen title="Familia" refreshing={follows.isRefetching} onRefresh={() => void refetch()}>
      {role.data === 'watch' ? <ShareSection /> : null}

      <View style={styles.section}>
        <SectionTitle>Casas que sigo</SectionTitle>
        {items && items.length > 0 ? (
          items.map((item) => <FollowRow key={item.homeId} item={item} now={now} />)
        ) : items ? (
          <Card>
            <Muted>Todavía no sigues ninguna casa. Pídele el código a quien la vigila.</Muted>
          </Card>
        ) : follows.isError ? (
          <ErrorBlock message={describeError(follows.error)} onRetry={() => void refetch()} />
        ) : (
          <Card>
            <Muted>Cargando…</Muted>
          </Card>
        )}
        {items && items.length >= MAX_FOLLOWS ? (
          <Muted>{`Sigues ${MAX_FOLLOWS} casas, el máximo.`}</Muted>
        ) : null}
        <Button label="Seguir una casa" onPress={() => router.push('/follow')} />
      </View>
    </TabScreen>
  );
}

function FollowRow({ item, now }: { item: FollowItem; now: number }) {
  const { refetch } = useFollows();
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setError(null);
    try {
      await unfollow(item.homeId);
      await refetch();
    } catch (failure) {
      setError(describeError(failure));
    }
  };

  return (
    <Card>
      <Text style={styles.alias}>{item.alias}</Text>
      <Text style={[styles.status, { color: STATE_COLOR[item.status.state] }]}>
        {formatStatus(item.status, now)}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={`Dejar de seguir ${item.alias}`} tone="danger" onPress={() => void remove()} />
    </Card>
  );
}

type RegenState = 'idle' | 'confirming' | 'working';

function ShareSection() {
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<RegenState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readShareCode()
      .then(setCode)
      .catch(() => undefined);
  }, []);

  const generate = async (): Promise<string | null> => {
    setError(null);
    setState('working');
    try {
      const fresh = await regenerate();
      setCode(fresh);
      return fresh;
    } catch (failure) {
      setError(describeError(failure));
      return null;
    } finally {
      setState('idle');
    }
  };

  // Sin código guardado (casa de antes de esta versión) no hay a quién quitar: el servidor nunca lo entregó a nadie.
  const share = async () => {
    const current = code ?? (await generate());
    if (!current) return;
    try {
      await Share.share({ message: shareMessage(current) });
    } catch {
      setError('No se pudo abrir el menú de compartir.');
    }
  };

  return (
    <View style={styles.section}>
      <SectionTitle>Mi casa</SectionTitle>
      <Card>
        {code ? <Text style={styles.code}>{code}</Text> : null}
        <Muted>
          Manda el enlace por WhatsApp para que tu familia vea cuándo se va y cuándo vuelve la luz.
        </Muted>
        <Button
          label="Compartir mi casa"
          tone="primary"
          onPress={() => void share()}
          disabled={state === 'working'}
        />
        {code && state === 'idle' ? (
          <Button label="Regenerar código" onPress={() => setState('confirming')} />
        ) : null}
        {state === 'confirming' ? (
          <>
            <Text style={styles.warning}>{REGENERATE_WARNING}</Text>
            <Button label="Sí, regenerar" tone="danger" onPress={() => void generate()} />
            <Button label="Cancelar" onPress={() => setState('idle')} />
          </>
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  alias: { color: colors.textMuted, fontSize: 15 },
  status: { fontSize: 18, fontWeight: '700', lineHeight: 26 },
  code: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: 4 },
  warning: { color: colors.text, fontSize: 15, lineHeight: 22 },
  error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
});
