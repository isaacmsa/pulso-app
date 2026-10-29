import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { ApiError } from '../../shared/api/client';
import { colors } from '../../shared/theme/colors';
import { readUpsMode, setUpsMode } from './ups-mode';

type Props = { styleText?: object; styleMuted?: object };

/** "Mi router tiene UPS": solo para teléfonos que vigilan. Cambia al instante y vuelve atrás si el servidor falla. */
export function UpsModeSwitch({ styleText, styleMuted }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    readUpsMode().then((value) => {
      if (!touched.current) setEnabled(value);
    });
  }, []);

  const toggle = async (next: boolean) => {
    if (saving) return;
    const previous = enabled;
    touched.current = true;
    setError(null);
    setSaving(true);
    setEnabled(next);
    try {
      if (!(await setUpsMode(next))) {
        setError('Listo, pero no se pudo recordar en este teléfono.');
      }
    } catch (e) {
      setEnabled(previous);
      const offline = e instanceof ApiError && (e.code === 'network' || e.code === 'timeout');
      setError(
        offline
          ? 'Sin conexión con el servidor. Revisa tu internet.'
          : 'No se pudo cambiar. Intenta de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Text style={[styles.label, styleText]}>Mi router tiene UPS</Text>
        <Switch
          value={enabled}
          disabled={saving}
          onValueChange={(next) => void toggle(next)}
          accessibilityLabel="Mi router tiene UPS"
        />
      </View>
      <Text style={[styles.muted, styleMuted]}>
        Experimental. Si el router sigue prendido con un mini UPS cuando se va la luz, el Wi-Fi no
        se cae, así que Pulso se fía solo del cargador.
      </Text>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.text, fontSize: 16, flexShrink: 1 },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
});
