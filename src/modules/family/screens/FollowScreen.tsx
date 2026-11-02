import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { ApiError } from '../../../shared/api/client';
import { colors } from '../../../shared/theme/colors';
import { describeError } from '../../home/format';
import { Button, Card, Muted, TabScreen } from '../../home/ui';
import { isValidCode, MAX_FOLLOWS, normalizeCode } from '../code';
import { FOLLOWS_KEY, follow } from '../queries';

const CODE_HELP =
  'El código tiene 8 letras y números, sin 0, 1, I, L ni O. Pídeselo a quien vigila la casa.';

function describeFollowError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'not_found') return 'Ese código no existe';
  // El código y el nombre ya se validaron aquí: lo que el servidor rechaza con 400 es el tope de casas.
  if (error instanceof ApiError && error.code === 'validation_failed') {
    return `Ya sigues el máximo de ${MAX_FOLLOWS} casas. Deja de seguir alguna para agregar otra.`;
  }
  return describeError(error);
}

/** "Seguir esta casa": se llega desde Familia o desde el enlace `/c/CODIGO` (que trae el código escrito). */
export default function FollowScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fromLink = Array.isArray(params.code) ? params.code[0] : params.code;
  const [code, setCode] = useState(() => normalizeCode(fromLink ?? ''));
  const [alias, setAlias] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onCode = (text: string) => {
    setCode(normalizeCode(text));
    setError(null);
  };

  const submit = async () => {
    const name = alias.trim();
    if (!isValidCode(code)) {
      setError(CODE_HELP);
      return;
    }
    if (name.length === 0 || name.length > 40) {
      setError('Ponle un nombre de hasta 40 letras, por ejemplo "Casa de mamá".');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await follow(code, name);
      await queryClient.invalidateQueries({ queryKey: FOLLOWS_KEY });
      router.replace('/family');
    } catch (failure) {
      setError(describeFollowError(failure));
      setSaving(false);
    }
  };

  const invalid = code.length > 0 && !isValidCode(code) && code.length >= 8;
  return (
    <TabScreen title="Seguir una casa">
      <Card>
        <Muted>
          Escribe el código que te mandaron y el nombre con el que quieres ver esa casa.
        </Muted>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={onCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          placeholder="ABCD2345"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Código de la casa"
        />
        {invalid ? <Text style={styles.error}>{CODE_HELP}</Text> : null}
        <TextInput
          style={styles.input}
          value={alias}
          onChangeText={setAlias}
          maxLength={40}
          placeholder="Casa de mamá"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Cómo le dices a esta casa"
        />
        <Button
          label="Seguir esta casa"
          tone="primary"
          onPress={() => void submit()}
          disabled={saving}
        />
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </Card>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
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
  error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
});
