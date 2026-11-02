import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ApiError, resolveApiUrl, unwrap } from '../../../shared/api/client';
import { updateHome } from '../../../shared/api/generated';
import { colors } from '../../../shared/theme/colors';
import { restartOnboardingAtRole } from '../../onboarding/progress';
import { requestForegroundService } from '../../power-detection/foreground-service';
import { isForegroundServiceEnabled } from '../../power-detection/power-monitor';
import { DELETE_DATA_URL, deleteMyData, NoTokenError, WipeError } from '../delete-data';
import { useHomeStatus, useRole } from '../queries';
import { UpsModeSwitch } from '../UpsModeSwitch';
import { Button, Card, Muted, SectionTitle, TabScreen } from '../ui';

export default function SettingsScreen() {
  const router = useRouter();
  const role = useRole();
  // Mientras se lee el rol no se muestra lo que solo vigila: un teléfono "follow" no tiene casa ni detección.
  const watches = role.data !== undefined && role.data !== 'follow';

  const openPrivacy = () => {
    Linking.openURL(`${resolveApiUrl(process.env.EXPO_PUBLIC_API_URL)}/privacidad`).catch(
      () => undefined,
    );
  };

  return (
    <TabScreen title="Ajustes">
      {watches ? <AliasSection /> : null}
      {watches ? <ForegroundServiceSection /> : null}
      {watches ? (
        <View style={styles.section}>
          <SectionTitle>Tu router</SectionTitle>
          <Card>
            <UpsModeSwitch />
          </Card>
        </View>
      ) : null}
      {role.data === 'follow' ? <WatchThisHomeSection /> : null}

      <Card>
        <Row label="Diagnóstico" onPress={() => router.push('/debug')} />
        <Row label="Política de privacidad" onPress={openPrivacy} />
      </Card>

      <DeleteSection />
    </TabScreen>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function WatchThisHomeSection() {
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    try {
      await restartOnboardingAtRole();
      // La raíz vuelve al onboarding al avisar; esta pantalla ya no se ve.
    } catch {
      setError('No se pudo cambiar. Intenta de nuevo.');
    }
  };

  return (
    <View style={styles.section}>
      <SectionTitle>Este teléfono</SectionTitle>
      <Card>
        <Row label="Vigilar esta casa" onPress={() => void start()} />
        <Muted>Si este teléfono se queda enchufado en casa, Pulso detecta solo los cortes.</Muted>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>
    </View>
  );
}

function AliasSection() {
  const queryClient = useQueryClient();
  const status = useHomeStatus();
  const [typed, setTyped] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const value = typed ?? status.data?.status.alias ?? '';

  const save = async () => {
    const alias = value.trim();
    if (alias.length === 0 || alias.length > 40) {
      setMessage({ text: 'Escribe un nombre de hasta 40 letras.', error: true });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await unwrap(updateHome({ body: { alias } }));
      setTyped(alias);
      setMessage({ text: 'Listo, guardado.', error: false });
      await queryClient.invalidateQueries({ queryKey: ['home', 'status'] });
    } catch (error) {
      const offline =
        error instanceof ApiError && (error.code === 'network' || error.code === 'timeout');
      setMessage({
        text: offline
          ? 'Sin conexión con el servidor. Revisa tu internet.'
          : 'No se pudo guardar. Intenta de nuevo.',
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.section}>
      <SectionTitle>Nombre de la casa</SectionTitle>
      <Card>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setTyped}
          maxLength={40}
          placeholder="Casa"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Nombre de la casa"
        />
        {status.isError && !status.data ? (
          <Muted>No se pudo leer el nombre actual. Puedes escribir uno nuevo.</Muted>
        ) : null}
        <Button label="Guardar" onPress={() => void save()} disabled={saving} />
        {message ? (
          <Text style={message.error ? styles.error : styles.ok}>{message.text}</Text>
        ) : null}
      </Card>
    </View>
  );
}

// D-012 todavía no se decide: D sigue siendo una opción, apagada por defecto.
function ForegroundServiceSection() {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isForegroundServiceEnabled()
      .then(setEnabled)
      .catch(() => undefined);
  }, []);

  const toggle = async (next: boolean) => {
    setError(null);
    try {
      if ((await requestForegroundService(next)) === 'no_permission') {
        setError('Sin permiso de notificaciones el servicio no puede mostrarse.');
        return;
      }
      setEnabled(next);
    } catch {
      setError('No se pudo cambiar. Intenta de nuevo.');
    }
  };

  return (
    <View style={styles.section}>
      <SectionTitle>Detección</SectionTitle>
      <Card>
        <View style={styles.switchRow}>
          <Text style={styles.rowLabel}>Servicio en primer plano</Text>
          <Switch
            value={enabled}
            onValueChange={(next) => void toggle(next)}
            accessibilityLabel="Servicio en primer plano"
          />
        </View>
        <Muted>
          Experimental. Deja una notificación fija para detectar los cortes aunque el sistema duerma
          la app.
        </Muted>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>
    </View>
  );
}

type DeleteState = 'idle' | 'confirming' | 'deleting' | { error: string };

function DeleteSection() {
  const [state, setState] = useState<DeleteState>('idle');

  const run = async () => {
    setState('deleting');
    try {
      await deleteMyData();
      // La raíz vuelve al onboarding al avisar; esta pantalla ya no se ve.
    } catch (error) {
      if (error instanceof NoTokenError) {
        setState({
          error: `Este teléfono perdió su registro y no puede pedirle el borrado al servidor. No se tocó nada. Pide el borrado de lo que guarda el servidor en ${DELETE_DATA_URL}.`,
        });
        return;
      }
      if (error instanceof WipeError) {
        setState({
          error: 'Se borró en el servidor, pero no se pudo limpiar este teléfono. Toca reintentar.',
        });
        return;
      }
      const offline =
        error instanceof ApiError && (error.code === 'network' || error.code === 'timeout');
      setState({
        error: `No se pudo borrar: ${
          offline ? 'no hay conexión con el servidor' : 'el servidor respondió con un error'
        }. No se tocó nada en este teléfono.`,
      });
    }
  };

  return (
    <View style={styles.section}>
      <SectionTitle>Tus datos</SectionTitle>
      <Card>
        {state === 'idle' ? (
          <Button label="Borrar mis datos" tone="danger" onPress={() => setState('confirming')} />
        ) : null}
        {state === 'confirming' ? (
          <>
            <Text style={styles.warning}>
              Se borra todo lo tuyo del servidor y de este teléfono: la casa, el historial y el
              registro. No se puede deshacer.
            </Text>
            <Button label="Sí, borrar" tone="danger" onPress={() => void run()} />
            <Button label="Cancelar" onPress={() => setState('idle')} />
          </>
        ) : null}
        {state === 'deleting' ? <Muted>Borrando…</Muted> : null}
        {typeof state === 'object' ? (
          <>
            <Text style={styles.error} accessibilityRole="alert">
              {state.error}
            </Text>
            <Button label="Reintentar" tone="danger" onPress={() => void run()} />
            <Button label="Cancelar" onPress={() => setState('idle')} />
          </>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: 10,
  },
  rowLabel: { color: colors.text, fontSize: 16, flexShrink: 1 },
  chevron: { color: colors.textMuted, fontSize: 22 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 48,
  },
  input: {
    color: colors.text,
    fontSize: 16,
    borderColor: colors.textMuted,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  warning: { color: colors.text, fontSize: 15, lineHeight: 22 },
  error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
  ok: { color: colors.ok, fontSize: 15 },
});
