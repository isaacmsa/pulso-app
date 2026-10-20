import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../src/shared/theme/colors';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pulso</Text>
      <Link href="/debug" style={styles.link}>
        Abrir registrador
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontSize: 40, fontWeight: '700' },
  link: { color: colors.accent, fontSize: 18 },
});
