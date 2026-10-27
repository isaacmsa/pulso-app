// AsyncStorage guarda la caché de TanStack Query; en las pruebas es uno en memoria.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// El mock de AppState de React Native devuelve undefined al suscribirse; el focusManager de TanStack Query
// (src/shared/query/client.ts) necesita la suscripción para poder cancelarla.
const { AppState } = require('react-native');
AppState.addEventListener = () => ({ remove: () => undefined });
